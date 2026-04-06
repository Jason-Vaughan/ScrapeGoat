import { describe, expect, it } from 'vitest'
import { buildTemplate } from './templateBuilder'
import type { AiAnalysis, WizardAnswers } from '../hooks/useWizardReducer'

/** Helper to create a minimal AI analysis. */
function mockAnalysis(): AiAnalysis {
  return {
    documentStructure: {
      options: [{ label: 'Block', value: 'block', source: 'sample' }],
    },
    dateFormats: {
      detected: [
        {
          label: 'MM/DD/YYYY',
          pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
          format: 'MM/DD/YYYY',
          examples: ['03/15/2026'],
          source: '03/15/2026',
        },
      ],
    },
    locations: {
      candidates: [
        { name: 'Hall A', confidence: 'high', source: 'Hall A' },
        { name: 'Lobby', confidence: 'low', source: 'lobby area' },
      ],
    },
    statusCodes: {
      candidates: [
        { name: 'Confirmed', confidence: 'high', source: 'Confirmed' },
      ],
    },
    eventNames: {
      candidates: [{ name: 'Conference', source: 'Conference...' }],
    },
    estimatedEventCount: 10,
    detectedTimezone: 'America/New_York',
    notes: null,
  }
}

/** Helper to create full wizard answers. */
function fullAnswers(): WizardAnswers {
  return {
    documentStructure: 'block',
    dateFormat: {
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
      format: 'MM/DD/YYYY',
    },
    timezone: 'America/Chicago',
    locations: ['Hall A', 'Hall B'],
    statusCodes: ['Confirmed', 'Tentative'],
    eventNamePosition: 'first_line',
  }
}

describe('buildTemplate', () => {
  it('builds a valid ProfileTemplate from full answers', () => {
    const template = buildTemplate('Test Template', fullAnswers(), mockAnalysis())
    expect(template.name).toBe('Test Template')
    expect(template.version).toBe('1.0')
    expect(template.structure.type).toBe('block')
    expect(template.dateFormats).toHaveLength(1)
    expect(template.fields.eventName?.position).toBe('first_line')
    expect(template.fields.location?.knownValues).toEqual(['Hall A', 'Hall B'])
    expect(template.fields.status?.knownValues).toEqual(['Confirmed', 'Tentative'])
    expect(template.timezone).toBe('America/Chicago')
  })

  it('uses AI defaults when answers are skipped (null)', () => {
    const skipped: WizardAnswers = {
      documentStructure: null,
      dateFormat: null,
      timezone: null,
      locations: [],
      statusCodes: [],
      eventNamePosition: null,
    }
    const template = buildTemplate('Skipped Wizard', skipped, mockAnalysis())
    // Falls back to AI's first structure option
    expect(template.structure.type).toBe('block')
    // Falls back to AI's first date format
    expect(template.dateFormats[0].pattern).toContain('month')
    // Falls back to AI's detected timezone
    expect(template.timezone).toBe('America/New_York')
    // Falls back to high-confidence AI locations
    expect(template.fields.location?.knownValues).toEqual(['Hall A'])
    // Falls back to high-confidence AI status codes
    expect(template.fields.status?.knownValues).toEqual(['Confirmed'])
  })

  it('defaults to "Untitled Template" when name is empty', () => {
    const template = buildTemplate('', fullAnswers(), mockAnalysis())
    expect(template.name).toBe('Untitled Template')
  })

  it('builds table structure correctly', () => {
    const answers = { ...fullAnswers(), documentStructure: 'table' }
    const template = buildTemplate('Table', answers, mockAnalysis())
    expect(template.structure.type).toBe('table')
    expect(template.structure.tableHeaders).toBeDefined()
  })

  it('builds list structure correctly', () => {
    const answers = { ...fullAnswers(), documentStructure: 'list' }
    const template = buildTemplate('List', answers, mockAnalysis())
    expect(template.structure.type).toBe('list')
    expect(template.structure.linePattern).toBeDefined()
  })

  it('sets created timestamp', () => {
    const template = buildTemplate('Time Check', fullAnswers(), mockAnalysis())
    expect(template.created).toBeDefined()
    // Should be a valid ISO date
    expect(() => new Date(template.created!)).not.toThrow()
  })

  it('passes Zod validation (does not throw)', () => {
    expect(() =>
      buildTemplate('Valid', fullAnswers(), mockAnalysis())
    ).not.toThrow()
  })

  it('omits eventName field when position is null', () => {
    const answers = { ...fullAnswers(), eventNamePosition: null }
    const template = buildTemplate('No Position', answers, mockAnalysis())
    expect(template.fields.eventName).toBeUndefined()
  })

  it('handles "other" structure type by defaulting to block', () => {
    const answers = { ...fullAnswers(), documentStructure: 'other' }
    const template = buildTemplate('Other', answers, mockAnalysis())
    expect(template.structure.type).toBe('block')
  })
})
