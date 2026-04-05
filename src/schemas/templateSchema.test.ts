import { describe, it, expect } from 'vitest'
import { templateSchema, communityIndexSchema } from './templateSchema'

/** Minimal valid template matching spec 5.1. */
const validTemplate = {
  name: 'Test Convention Calendar',
  version: '1.0',
  structure: { type: 'block' as const, blockDelimiter: '^\\d{1,2}/\\d{1,2}' },
  dateFormats: [
    {
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})',
      format: 'MM/DD/YYYY',
      fields: ['startDate' as const, 'endDate' as const],
    },
  ],
  fields: {
    eventName: { position: 'first_line' as const },
    location: { knownValues: ['Hall A', 'Hall B'] },
    status: { knownValues: ['Confirmed', 'Tentative'] },
  },
  timezone: 'America/New_York',
}

describe('templateSchema', () => {
  it('accepts a valid template with all required fields', () => {
    const result = templateSchema.safeParse(validTemplate)
    expect(result.success).toBe(true)
  })

  it('accepts a template with optional fields', () => {
    const full = {
      ...validTemplate,
      author: 'community',
      source: 'Convention Center website',
      created: '2026-04-01',
      lastTested: '2026-04-01',
      eventsTestedCount: 42,
      customFields: [
        { name: 'attendance', pattern: 'Attendance:\\s*(\\d+)', description: 'Expected attendance' },
      ],
    }
    const result = templateSchema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('rejects a template missing name', () => {
    const { name: _, ...noName } = validTemplate
    const result = templateSchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it('rejects a template with empty name', () => {
    const result = templateSchema.safeParse({ ...validTemplate, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a template missing structure', () => {
    const { structure: _, ...noStructure } = validTemplate
    const result = templateSchema.safeParse(noStructure)
    expect(result.success).toBe(false)
  })

  it('rejects a template missing dateFormats', () => {
    const { dateFormats: _, ...noDateFormats } = validTemplate
    const result = templateSchema.safeParse(noDateFormats)
    expect(result.success).toBe(false)
  })

  it('rejects a template with empty dateFormats array', () => {
    const result = templateSchema.safeParse({ ...validTemplate, dateFormats: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid structure type', () => {
    const bad = { ...validTemplate, structure: { type: 'grid' } }
    const result = templateSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects invalid date field name', () => {
    const bad = {
      ...validTemplate,
      dateFormats: [{ pattern: '.*', fields: ['invalidField'] }],
    }
    const result = templateSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('accepts all three structure types', () => {
    for (const type of ['block', 'table', 'list'] as const) {
      const t = { ...validTemplate, structure: { type } }
      expect(templateSchema.safeParse(t).success).toBe(true)
    }
  })

  it('accepts all valid date field names', () => {
    const validFields = ['startDate', 'endDate', 'moveInDate', 'moveOutDate', 'singleDate']
    for (const field of validFields) {
      const t = {
        ...validTemplate,
        dateFormats: [{ pattern: '.*', fields: [field] }],
      }
      expect(templateSchema.safeParse(t).success).toBe(true)
    }
  })

  it('accepts nullable timezone', () => {
    const result = templateSchema.safeParse({ ...validTemplate, timezone: null })
    expect(result.success).toBe(true)
  })

  it('rejects negative eventsTestedCount', () => {
    const result = templateSchema.safeParse({ ...validTemplate, eventsTestedCount: -1 })
    expect(result.success).toBe(false)
  })
})

describe('communityIndexSchema', () => {
  it('accepts a valid index', () => {
    const index = {
      version: '1.0',
      lastUpdated: '2026-04-05',
      templates: [
        {
          id: 'test-calendar',
          name: 'Test Calendar',
          file: 'test-calendar.json',
          source: 'Test Venue',
          author: 'contributor',
          created: '2026-04-01',
          lastTested: '2026-04-01',
          eventsTestedCount: 10,
          tags: ['venue', 'test'],
          description: 'A test template',
        },
      ],
    }
    const result = communityIndexSchema.safeParse(index)
    expect(result.success).toBe(true)
  })

  it('accepts an empty templates array', () => {
    const index = {
      version: '1.0',
      lastUpdated: '2026-04-05',
      templates: [],
    }
    const result = communityIndexSchema.safeParse(index)
    expect(result.success).toBe(true)
  })

  it('rejects index missing version', () => {
    const result = communityIndexSchema.safeParse({
      lastUpdated: '2026-04-05',
      templates: [],
    })
    expect(result.success).toBe(false)
  })
})
