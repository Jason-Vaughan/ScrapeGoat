import { describe, it, expect, vi } from 'vitest'
import { generateJson, DEFAULT_JSON_OPTIONS } from '../exportJson'
import type { JsonExportOptions } from '../exportJson'
import type { ParsedEvent } from '../parser'

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'sha256-abc123',
    name: 'ACME Trade Show',
    startDate: '2026-03-15',
    endDate: '2026-03-18',
    moveInDate: '2026-03-13',
    moveOutDate: '2026-03-20',
    location: 'Hall A',
    status: 'Confirmed',
    customFields: {},
    rawText: 'raw text here',
    warnings: [{ field: 'endDate', message: 'Ambiguous date', rawValue: '3/18', suggestion: '2026-03-18' }],
    isSelected: true,
    ...overrides,
  }
}

describe('generateJson', () => {
  it('produces valid JSON', () => {
    const result = generateJson([makeEvent()], DEFAULT_JSON_OPTIONS)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('includes generator metadata', () => {
    const result = JSON.parse(generateJson([makeEvent()], DEFAULT_JSON_OPTIONS))
    expect(result.generator).toBe('ScrapeGoat v1.0')
    expect(result.exported).toBeTruthy()
    expect(result.eventCount).toBe(1)
  })

  it('includes template name and timezone', () => {
    const result = JSON.parse(
      generateJson([makeEvent()], DEFAULT_JSON_OPTIONS, 'Javits Calendar', 'America/New_York'),
    )
    expect(result.template).toBe('Javits Calendar')
    expect(result.timezone).toBe('America/New_York')
  })

  it('uses null for missing template', () => {
    const result = JSON.parse(generateJson([makeEvent()], DEFAULT_JSON_OPTIONS))
    expect(result.template).toBeNull()
  })

  it('preserves null fields on events', () => {
    const event = makeEvent({ endDate: null, location: null })
    const result = JSON.parse(generateJson([event], DEFAULT_JSON_OPTIONS))
    expect(result.events[0].endDate).toBeNull()
    expect(result.events[0].location).toBeNull()
  })

  it('is pretty-printed by default (2-space indent)', () => {
    const result = generateJson([makeEvent()], DEFAULT_JSON_OPTIONS)
    expect(result).toContain('  "generator"')
  })

  it('produces compact JSON when prettyPrint is false', () => {
    const opts: JsonExportOptions = { includeRawText: false, prettyPrint: false }
    const result = generateJson([makeEvent()], opts)
    // Should be a single line (plus trailing newline)
    const lines = result.trim().split('\n')
    expect(lines.length).toBe(1)
  })

  it('excludes rawText by default', () => {
    const result = JSON.parse(generateJson([makeEvent()], DEFAULT_JSON_OPTIONS))
    expect(result.events[0]).not.toHaveProperty('rawText')
  })

  it('includes rawText when option is set', () => {
    const opts: JsonExportOptions = { includeRawText: true, prettyPrint: true }
    const result = JSON.parse(generateJson([makeEvent()], opts))
    expect(result.events[0].rawText).toBe('raw text here')
  })

  it('includes warnings with field and message only', () => {
    const result = JSON.parse(generateJson([makeEvent()], DEFAULT_JSON_OPTIONS))
    expect(result.events[0].warnings).toEqual([
      { field: 'endDate', message: 'Ambiguous date' },
    ])
  })

  it('skips unselected events', () => {
    const events = [
      makeEvent(),
      makeEvent({ id: 'skipped', name: 'Skipped', isSelected: false }),
    ]
    const result = JSON.parse(generateJson(events, DEFAULT_JSON_OPTIONS))
    expect(result.eventCount).toBe(1)
    expect(result.events[0].name).toBe('ACME Trade Show')
  })

  it('includes customFields', () => {
    const event = makeEvent({ customFields: { booth: 'A-42' } })
    const result = JSON.parse(generateJson([event], DEFAULT_JSON_OPTIONS))
    expect(result.events[0].customFields).toEqual({ booth: 'A-42' })
  })

  it('ends with a newline', () => {
    const result = generateJson([makeEvent()], DEFAULT_JSON_OPTIONS)
    expect(result.endsWith('\n')).toBe(true)
  })

  it('uses ISO 8601 for the exported timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'))
    const result = JSON.parse(generateJson([makeEvent()], DEFAULT_JSON_OPTIONS))
    expect(result.exported).toBe('2026-04-01T12:00:00.000Z')
    vi.useRealTimers()
  })
})
