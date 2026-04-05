import { describe, it, expect } from 'vitest'
import type { ProfileTemplate } from '../schemas/templateSchema'
import {
  parseText,
  generateEventId,
  stripPageBreaks,
  extractDates,
  extractEventName,
  extractByKnownOrPattern,
  extractCustomFields,
  deduplicateEvents,
  sortByStartDate,
  validateDateLogic,
  postProcess,
  isValidDate,
  safeRegex,
} from './parser'
import type { ParsedEvent } from './parser'
import { PAGE_BREAK_MARKER } from './pdfExtractor'

// ---------------------------------------------------------------------------
// Helper: minimal template factory
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Partial<ProfileTemplate> = {}): ProfileTemplate {
  return {
    name: 'Test Template',
    version: '1.0',
    structure: { type: 'block', blockDelimiter: '^---$' },
    dateFormats: [
      {
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
        format: 'M/D/YY',
        fields: ['startDate', 'endDate'],
      },
    ],
    fields: {
      eventName: { position: 'first_line' },
    },
    ...overrides,
  }
}

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'abc123',
    name: 'Test Event',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    moveInDate: null,
    moveOutDate: null,
    location: null,
    status: null,
    customFields: {},
    rawText: 'raw text',
    warnings: [],
    isSelected: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// generateEventId
// ---------------------------------------------------------------------------

describe('generateEventId', () => {
  it('produces a hex string', async () => {
    const id = await generateEventId('Event', '2026-01-01', 'Hall A')
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces the same hash for the same inputs', async () => {
    const a = await generateEventId('Event', '2026-01-01', 'Hall A')
    const b = await generateEventId('Event', '2026-01-01', 'Hall A')
    expect(a).toBe(b)
  })

  it('produces different hashes for different inputs', async () => {
    const a = await generateEventId('Event A', '2026-01-01', 'Hall A')
    const b = await generateEventId('Event B', '2026-01-01', 'Hall A')
    expect(a).not.toBe(b)
  })

  it('handles null startDate and location', async () => {
    const id = await generateEventId('Event', null, null)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ---------------------------------------------------------------------------
// stripPageBreaks
// ---------------------------------------------------------------------------

describe('stripPageBreaks', () => {
  it('removes page break markers', () => {
    const text = `Page 1 text${PAGE_BREAK_MARKER}Page 2 text`
    const result = stripPageBreaks(text)
    expect(result).toBe('Page 1 text\nPage 2 text')
    expect(result).not.toContain('PAGE BREAK')
  })

  it('handles text without page breaks', () => {
    const text = 'No breaks here'
    expect(stripPageBreaks(text)).toBe(text)
  })

  it('handles multiple page breaks', () => {
    const text = `A${PAGE_BREAK_MARKER}B${PAGE_BREAK_MARKER}C`
    const result = stripPageBreaks(text)
    expect(result).toBe('A\nB\nC')
  })
})

// ---------------------------------------------------------------------------
// extractDates
// ---------------------------------------------------------------------------

describe('extractDates', () => {
  const dateFormats = [
    {
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
      format: 'M/D/YY',
      fields: ['startDate', 'endDate'] as ('startDate' | 'endDate')[],
    },
  ]

  it('extracts start and end dates from two matches', () => {
    const { dates } = extractDates('Event 1/5/26 to 1/8/26', dateFormats)
    expect(dates.startDate).toBe('2026-01-05')
    expect(dates.endDate).toBe('2026-01-08')
  })

  it('copies startDate to endDate when only one date found', () => {
    const { dates } = extractDates('Event on 3/15/2026', dateFormats)
    expect(dates.startDate).toBe('2026-03-15')
    expect(dates.endDate).toBe('2026-03-15')
  })

  it('handles 4-digit years', () => {
    const { dates } = extractDates('Event on 12/25/2026', dateFormats)
    expect(dates.startDate).toBe('2026-12-25')
  })

  it('handles 2-digit years', () => {
    const { dates } = extractDates('Event on 6/1/27', dateFormats)
    expect(dates.startDate).toBe('2027-06-01')
  })

  it('warns on ambiguous dates', () => {
    const { warnings } = extractDates('Event on 1/2/2026', dateFormats)
    expect(warnings.some((w) => w.message.includes('Ambiguous'))).toBe(true)
  })

  it('does not warn when month and day are unambiguous', () => {
    const { warnings } = extractDates('Event on 1/15/2026', dateFormats)
    expect(warnings.some((w) => w.message.includes('Ambiguous'))).toBe(false)
  })

  it('does not warn when month equals day', () => {
    const { warnings } = extractDates('Event on 3/3/2026', dateFormats)
    expect(warnings.some((w) => w.message.includes('Ambiguous'))).toBe(false)
  })

  it('extracts move-in and move-out dates with appropriate fields config', () => {
    const fmts = [
      {
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
        format: 'M/D/YY',
        fields: ['moveInDate', 'startDate', 'endDate', 'moveOutDate'] as (
          | 'moveInDate'
          | 'startDate'
          | 'endDate'
          | 'moveOutDate'
        )[],
      },
    ]
    const { dates } = extractDates('9/10/25  9/15/25  9/18/25  9/20/25', fmts)
    expect(dates.moveInDate).toBe('2025-09-10')
    expect(dates.startDate).toBe('2025-09-15')
    expect(dates.endDate).toBe('2025-09-18')
    expect(dates.moveOutDate).toBe('2025-09-20')
  })

  it('returns empty dates when no match', () => {
    const { dates } = extractDates('No dates here', dateFormats)
    expect(Object.keys(dates)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// extractEventName
// ---------------------------------------------------------------------------

describe('extractEventName', () => {
  const dateFormats = [
    {
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
      format: 'M/D/YY',
      fields: ['startDate'] as ('startDate')[],
    },
  ]

  it('extracts first_line name', () => {
    const name = extractEventName(
      'Annual Conference\n1/5/2026\nHall A',
      { eventName: { position: 'first_line' } },
      dateFormats
    )
    expect(name).toBe('Annual Conference')
  })

  it('extracts after_date name', () => {
    const name = extractEventName(
      '1/5/2026\nAnnual Conference\nHall A',
      { eventName: { position: 'after_date' } },
      dateFormats
    )
    expect(name).toBe('Annual Conference')
  })

  it('extracts before_date name', () => {
    const name = extractEventName(
      'Annual Conference\n1/5/2026\nHall A',
      { eventName: { position: 'before_date' } },
      dateFormats
    )
    expect(name).toBe('Annual Conference')
  })

  it('extracts regex name', () => {
    const name = extractEventName(
      'Event: Annual Conference | 1/5/2026',
      { eventName: { position: 'regex', pattern: 'Event:\\s*(.+?)\\s*\\|' } },
      dateFormats
    )
    expect(name).toBe('Annual Conference')
  })

  it('defaults to first line when no config', () => {
    const name = extractEventName('First Line\nSecond Line', {}, dateFormats)
    expect(name).toBe('First Line')
  })

  it('returns empty string for empty text', () => {
    const name = extractEventName(
      '',
      { eventName: { position: 'first_line' } },
      dateFormats
    )
    expect(name).toBe('')
  })
})

// ---------------------------------------------------------------------------
// extractByKnownOrPattern
// ---------------------------------------------------------------------------

describe('extractByKnownOrPattern', () => {
  it('matches known values case-insensitively', () => {
    const result = extractByKnownOrPattern('Event at hall a today', {
      knownValues: ['Hall A', 'Hall B'],
    })
    expect(result).toBe('Hall A')
  })

  it('falls back to pattern when no known match', () => {
    const result = extractByKnownOrPattern('Location: Room 5', {
      knownValues: ['Hall A'],
      pattern: 'Location:\\s*(.+)',
    })
    expect(result).toBe('Room 5')
  })

  it('prefers known values over pattern', () => {
    const result = extractByKnownOrPattern('Event at Hall A, Location: Room 5', {
      knownValues: ['Hall A'],
      pattern: 'Location:\\s*(.+)',
    })
    expect(result).toBe('Hall A')
  })

  it('returns null when no config', () => {
    expect(extractByKnownOrPattern('text', undefined)).toBeNull()
  })

  it('returns null when no match', () => {
    const result = extractByKnownOrPattern('text', {
      knownValues: ['Hall A'],
      pattern: 'Location:\\s*(.+)',
    })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractCustomFields
// ---------------------------------------------------------------------------

describe('extractCustomFields', () => {
  it('extracts custom fields by regex', () => {
    const result = extractCustomFields('Attendance: 5000, Booths: 120', [
      { name: 'attendance', pattern: 'Attendance:\\s*(\\d+)' },
      { name: 'booths', pattern: 'Booths:\\s*(\\d+)' },
    ])
    expect(result.attendance).toBe('5000')
    expect(result.booths).toBe('120')
  })

  it('skips unmatched fields', () => {
    const result = extractCustomFields('Attendance: 5000', [
      { name: 'attendance', pattern: 'Attendance:\\s*(\\d+)' },
      { name: 'booths', pattern: 'Booths:\\s*(\\d+)' },
    ])
    expect(result.attendance).toBe('5000')
    expect(result.booths).toBeUndefined()
  })

  it('returns empty object for undefined customFields', () => {
    expect(extractCustomFields('text', undefined)).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Block-based parsing
// ---------------------------------------------------------------------------

describe('parseText — block parser', () => {
  const template = makeTemplate({
    structure: { type: 'block', blockDelimiter: '^---$' },
    fields: {
      eventName: { position: 'first_line' },
      location: { knownValues: ['Hall A', 'Hall B'] },
      status: { knownValues: ['Confirmed', 'Tentative'] },
    },
  })

  it('parses multiple blocks', async () => {
    const text = `---
Annual Conference
1/15/2026
Hall A
Confirmed
---
Trade Show
2/20/2026
Hall B
Tentative`

    const events = await parseText(text, template)
    expect(events).toHaveLength(2)
    expect(events[0].name).toBe('Annual Conference')
    expect(events[0].startDate).toBe('2026-01-15')
    expect(events[0].location).toBe('Hall A')
    expect(events[0].status).toBe('Confirmed')
    expect(events[1].name).toBe('Trade Show')
    expect(events[1].startDate).toBe('2026-02-20')
    expect(events[1].location).toBe('Hall B')
    expect(events[1].status).toBe('Tentative')
  })

  it('handles events spanning page breaks', async () => {
    const text = `---
Annual Conference
1/15/2026${PAGE_BREAK_MARKER}Hall A
Confirmed`

    const events = await parseText(text, template)
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('Annual Conference')
    expect(events[0].location).toBe('Hall A')
  })

  it('generates warnings for missing dates', async () => {
    const text = `---
No Date Event
Hall A`

    const events = await parseText(text, template)
    expect(events).toHaveLength(1)
    expect(events[0].warnings.some((w) => w.field === 'startDate')).toBe(true)
  })

  it('generates SHA-256 IDs', async () => {
    const text = `---
Event One
3/1/2026`

    const events = await parseText(text, template)
    expect(events[0].id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('sets isSelected to true for all events', async () => {
    const text = `---
Event A
1/1/2026
---
Event B
2/1/2026`

    const events = await parseText(text, template)
    expect(events.every((e) => e.isSelected)).toBe(true)
  })

  it('extracts custom fields', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'block', blockDelimiter: '^---$' },
      customFields: [
        { name: 'contract', pattern: 'Contract#\\s*(\\d+)' },
      ],
    })

    const text = `---
Big Event
1/10/2026
Contract# 174636`

    const events = await parseText(text, tmpl)
    expect(events[0].customFields.contract).toBe('174636')
  })

  it('preserves rawText from the block', async () => {
    const text = `---
My Event
5/5/2026`

    const events = await parseText(text, template)
    expect(events[0].rawText).toContain('My Event')
    expect(events[0].rawText).toContain('5/5/2026')
  })

  it('returns empty array when no blocks match delimiter', async () => {
    const events = await parseText('no delimiters here', template)
    expect(events).toHaveLength(0)
  })

  it('handles after_date name position', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'block', blockDelimiter: '^---$' },
      fields: { eventName: { position: 'after_date' } },
    })

    const text = `---
1/15/2026
Annual Conference`

    const events = await parseText(text, tmpl)
    expect(events[0].name).toBe('Annual Conference')
  })
})

// ---------------------------------------------------------------------------
// Table-based parsing
// ---------------------------------------------------------------------------

describe('parseText — table parser', () => {
  const template = makeTemplate({
    structure: {
      type: 'table',
      tableHeaders: ['In', 'Start', 'End', 'Out', 'Event Name', 'Facility'],
    },
    dateFormats: [
      {
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
        format: 'M/D/YY',
        fields: ['moveInDate', 'startDate', 'endDate', 'moveOutDate'],
      },
    ],
    fields: {
      eventName: { position: 'first_line' },
      location: { knownValues: ['North Hall', 'South Hall'] },
    },
  })

  it('parses a table with header row', async () => {
    const text = `Calendar Title
In         Start      End        Out        Event Name          Facility
9/10/25    9/15/25    9/18/25    9/20/25    Annual Conference   North Hall
10/1/25    10/5/25    10/8/25    10/10/25   Trade Show          South Hall`

    const events = await parseText(text, template)
    expect(events).toHaveLength(2)
    expect(events[0].name).toContain('Annual Conference')
    expect(events[0].moveInDate).toBe('2025-09-10')
    expect(events[0].startDate).toBe('2025-09-15')
    expect(events[1].name).toContain('Trade Show')
  })

  it('skips empty lines in table', async () => {
    const text = `In         Start      End        Out        Event Name          Facility
9/10/25    9/15/25    9/18/25    9/20/25    Conference          North Hall

10/1/25    10/5/25    10/8/25    10/10/25   Expo                South Hall`

    const events = await parseText(text, template)
    expect(events).toHaveLength(2)
  })

  it('returns empty when headers not found', async () => {
    const tmpl = makeTemplate({
      structure: {
        type: 'table',
        tableHeaders: ['Column1', 'Column2', 'Column3'],
      },
    })
    const events = await parseText('No matching headers here', tmpl)
    expect(events).toHaveLength(0)
  })

  it('returns empty when no tableHeaders configured', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'table' },
    })
    const events = await parseText('some text', tmpl)
    expect(events).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// List-based parsing
// ---------------------------------------------------------------------------

describe('parseText — list parser', () => {
  const template = makeTemplate({
    structure: {
      type: 'list',
      linePattern:
        '(?<name>.+?)\\s*\\|\\s*(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})\\s*\\|\\s*(?<location>.+)',
    },
    dateFormats: [
      {
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})',
        format: 'M/D/YYYY',
        fields: ['startDate'],
      },
    ],
    fields: {},
  })

  it('parses list-formatted lines', async () => {
    const text = `Annual Conference | 1/15/2026 | Hall A
Trade Show | 2/20/2026 | Hall B`

    const events = await parseText(text, template)
    expect(events).toHaveLength(2)
    expect(events[0].name).toBe('Annual Conference')
    expect(events[0].startDate).toBe('2026-01-15')
    expect(events[0].location).toBe('Hall A')
    expect(events[1].name).toBe('Trade Show')
    expect(events[1].location).toBe('Hall B')
  })

  it('skips non-matching lines', async () => {
    const text = `Header line — not an event
Annual Conference | 1/15/2026 | Hall A
Another non-matching line`

    const events = await parseText(text, template)
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('Annual Conference')
  })

  it('returns empty when no lines match', async () => {
    const events = await parseText('nothing matches here', template)
    expect(events).toHaveLength(0)
  })

  it('returns empty when no linePattern configured', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'list' },
    })
    const events = await parseText('text', tmpl)
    expect(events).toHaveLength(0)
  })

  it('picks up status from capture group', async () => {
    const tmpl = makeTemplate({
      structure: {
        type: 'list',
        linePattern:
          '(?<name>.+?)\\s*\\|\\s*(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})\\s*\\|\\s*(?<status>\\w+)',
      },
      dateFormats: [
        {
          pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})',
          format: 'M/D/YYYY',
          fields: ['startDate'],
        },
      ],
      fields: {},
    })

    const text = 'My Event | 3/1/2026 | Confirmed'
    const events = await parseText(text, tmpl)
    expect(events[0].status).toBe('Confirmed')
  })
})

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

describe('deduplicateEvents', () => {
  it('removes events with duplicate IDs', () => {
    const events = [
      makeEvent({ id: 'aaa', name: 'First' }),
      makeEvent({ id: 'aaa', name: 'Duplicate' }),
      makeEvent({ id: 'bbb', name: 'Second' }),
    ]
    const result = deduplicateEvents(events)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('First')
    expect(result[1].name).toBe('Second')
  })

  it('keeps all events when IDs are unique', () => {
    const events = [
      makeEvent({ id: 'aaa' }),
      makeEvent({ id: 'bbb' }),
      makeEvent({ id: 'ccc' }),
    ]
    expect(deduplicateEvents(events)).toHaveLength(3)
  })
})

describe('sortByStartDate', () => {
  it('sorts by startDate ascending', () => {
    const events = [
      makeEvent({ startDate: '2026-03-01' }),
      makeEvent({ startDate: '2026-01-01' }),
      makeEvent({ startDate: '2026-02-01' }),
    ]
    const result = sortByStartDate(events)
    expect(result[0].startDate).toBe('2026-01-01')
    expect(result[1].startDate).toBe('2026-02-01')
    expect(result[2].startDate).toBe('2026-03-01')
  })

  it('puts events without startDate at the end', () => {
    const events = [
      makeEvent({ startDate: null, name: 'No date' }),
      makeEvent({ startDate: '2026-01-01', name: 'Has date' }),
    ]
    const result = sortByStartDate(events)
    expect(result[0].name).toBe('Has date')
    expect(result[1].name).toBe('No date')
  })
})

describe('validateDateLogic', () => {
  it('warns when moveInDate > startDate', () => {
    const events = [
      makeEvent({ moveInDate: '2026-04-15', startDate: '2026-04-10' }),
    ]
    const result = validateDateLogic(events)
    expect(result[0].warnings.some((w) => w.field === 'moveInDate')).toBe(true)
  })

  it('warns when startDate > endDate', () => {
    const events = [
      makeEvent({ startDate: '2026-04-15', endDate: '2026-04-10' }),
    ]
    const result = validateDateLogic(events)
    expect(result[0].warnings.some((w) => w.field === 'endDate')).toBe(true)
  })

  it('warns when endDate > moveOutDate', () => {
    const events = [
      makeEvent({ endDate: '2026-04-20', moveOutDate: '2026-04-15' }),
    ]
    const result = validateDateLogic(events)
    expect(result[0].warnings.some((w) => w.field === 'moveOutDate')).toBe(true)
  })

  it('does not warn when dates are in correct order', () => {
    const events = [
      makeEvent({
        moveInDate: '2026-04-08',
        startDate: '2026-04-10',
        endDate: '2026-04-12',
        moveOutDate: '2026-04-14',
      }),
    ]
    const result = validateDateLogic(events)
    expect(result[0].warnings).toHaveLength(0)
  })

  it('skips validation when dates are null', () => {
    const events = [
      makeEvent({
        moveInDate: null,
        startDate: '2026-04-10',
        endDate: null,
        moveOutDate: null,
      }),
    ]
    const result = validateDateLogic(events)
    expect(result[0].warnings).toHaveLength(0)
  })
})

describe('postProcess', () => {
  it('deduplicates, sorts, and validates in one pass', () => {
    const events = [
      makeEvent({ id: 'bbb', startDate: '2026-03-01' }),
      makeEvent({ id: 'aaa', startDate: '2026-01-01' }),
      makeEvent({ id: 'bbb', startDate: '2026-03-01', name: 'Duplicate' }),
      makeEvent({
        id: 'ccc',
        startDate: '2026-02-01',
        endDate: '2026-01-15',
      }),
    ]
    const result = postProcess(events)

    // Deduped: 3 events
    expect(result).toHaveLength(3)

    // Sorted
    expect(result[0].startDate).toBe('2026-01-01')
    expect(result[1].startDate).toBe('2026-02-01')
    expect(result[2].startDate).toBe('2026-03-01')

    // Date validation warning on event with startDate > endDate
    expect(result[1].warnings.some((w) => w.field === 'endDate')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns empty array for unknown structure type', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'unknown' as 'block' },
    })
    const events = await parseText('some text', tmpl)
    expect(events).toHaveLength(0)
  })

  it('handles empty text input', async () => {
    const tmpl = makeTemplate()
    const events = await parseText('', tmpl)
    expect(events).toHaveLength(0)
  })

  it('handles singleDate field mapping', () => {
    const fmts = [
      {
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})',
        format: 'M/D/YYYY',
        fields: ['singleDate'] as ('singleDate')[],
      },
    ]
    const { dates } = extractDates('Event on 5/15/2026', fmts)
    expect(dates.startDate).toBe('2026-05-15')
    expect(dates.endDate).toBe('2026-05-15')
  })

  it('handles cross-page event blocks', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'block', blockDelimiter: '^\\*\\*\\*$' },
      fields: {
        eventName: { position: 'first_line' },
        location: { knownValues: ['Main Hall'] },
      },
    })

    const text = `***
Conference${PAGE_BREAK_MARKER}Main Hall
1/20/2026`

    const events = await parseText(text, tmpl)
    expect(events).toHaveLength(1)
    expect(events[0].location).toBe('Main Hall')
    expect(events[0].startDate).toBe('2026-01-20')
  })
})

// ---------------------------------------------------------------------------
// Critic review fixes
// ---------------------------------------------------------------------------

describe('isValidDate', () => {
  it('accepts valid dates', () => {
    expect(isValidDate(2026, 1, 15)).toBe(true)
    expect(isValidDate(2026, 12, 31)).toBe(true)
    expect(isValidDate(2024, 2, 29)).toBe(true) // leap year
  })

  it('rejects invalid dates', () => {
    expect(isValidDate(2026, 2, 31)).toBe(false) // Feb 31
    expect(isValidDate(2026, 2, 29)).toBe(false) // non-leap year
    expect(isValidDate(2026, 4, 31)).toBe(false) // April 31
    expect(isValidDate(2026, 13, 1)).toBe(false) // month 13
    expect(isValidDate(2026, 0, 1)).toBe(false)  // month 0
  })
})

describe('safeRegex', () => {
  it('returns a RegExp for valid patterns', () => {
    const r = safeRegex('\\d+', 'g')
    expect(r).toBeInstanceOf(RegExp)
  })

  it('returns null for invalid patterns', () => {
    const r = safeRegex('[invalid')
    expect(r).toBeNull()
  })
})

describe('Critic fixes', () => {
  it('warns on invalid calendar dates like Feb 31', () => {
    const fmts = [
      {
        pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})',
        format: 'M/D/YYYY',
        fields: ['startDate'] as ('startDate')[],
      },
    ]
    const { dates, warnings } = extractDates('Event on 2/31/2026', fmts)
    expect(dates.startDate).toBeUndefined()
    expect(warnings.some((w) => w.message.includes('does not exist'))).toBe(true)
  })

  it('list parser reports skipped lines as warnings', async () => {
    const tmpl = makeTemplate({
      structure: {
        type: 'list',
        linePattern:
          '(?<name>.+?)\\s*\\|\\s*(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})\\s*\\|\\s*(?<location>.+)',
      },
      dateFormats: [
        {
          pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})',
          format: 'M/D/YYYY',
          fields: ['startDate'],
        },
      ],
      fields: {},
    })

    const text = `Header line
Annual Conference | 1/15/2026 | Hall A
Footer line`

    const events = await parseText(text, tmpl)
    expect(events).toHaveLength(1)
    expect(
      events[0].warnings.some((w) => w.message.includes('2 line(s) did not match'))
    ).toBe(true)
  })

  it('handles invalid regex patterns gracefully', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'block', blockDelimiter: '[invalid' },
    })
    const events = await parseText('some text', tmpl)
    expect(events).toHaveLength(0)
  })

  it('handles invalid linePattern gracefully', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'list', linePattern: '(unclosed' },
    })
    const events = await parseText('some text', tmpl)
    expect(events).toHaveLength(0)
  })

  it('deduplicates events end-to-end through parseText', async () => {
    const tmpl = makeTemplate({
      structure: { type: 'block', blockDelimiter: '^---$' },
      fields: { eventName: { position: 'first_line' } },
    })

    const text = `---
Same Event
1/15/2026
---
Same Event
1/15/2026`

    const events = await parseText(text, tmpl)
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('Same Event')
  })
})
