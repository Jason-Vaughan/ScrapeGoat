import { describe, expect, it } from 'vitest'
import {
  aiAnalysisSchema,
  correctionResponseSchema,
  unrecognizedFormatSchema,
} from './aiResponseSchema'

/** Minimal valid AI analysis response. */
function validAnalysis() {
  return {
    documentStructure: {
      options: [{ label: 'Block', value: 'block', source: 'snippet' }],
    },
    dateFormats: {
      detected: [
        {
          label: 'MM/DD/YYYY',
          pattern: '\\d+/\\d+/\\d+',
          examples: ['03/15/2026'],
          source: '03/15/2026',
        },
      ],
    },
    locations: {
      candidates: [{ name: 'Hall A', confidence: 'high', source: 'Hall A' }],
    },
    statusCodes: {
      candidates: [{ name: 'Confirmed', confidence: 'high', source: 'Confirmed' }],
    },
    eventNames: {
      candidates: [{ name: 'Tech Conf', source: 'Tech Conf...' }],
    },
    estimatedEventCount: 10,
    detectedTimezone: 'America/New_York',
    notes: null,
  }
}

describe('aiAnalysisSchema', () => {
  it('accepts a valid analysis response', () => {
    const result = aiAnalysisSchema.safeParse(validAnalysis())
    expect(result.success).toBe(true)
  })

  it('accepts analysis with suggestedTemplateName', () => {
    const data = { ...validAnalysis(), suggestedTemplateName: 'Conference Calendar' }
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.suggestedTemplateName).toBe('Conference Calendar')
    }
  })

  it('accepts analysis with null suggestedTemplateName', () => {
    const data = { ...validAnalysis(), suggestedTemplateName: null }
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts analysis without suggestedTemplateName field', () => {
    const result = aiAnalysisSchema.safeParse(validAnalysis())
    expect(result.success).toBe(true)
  })

  it('rejects when documentStructure.options is empty', () => {
    const data = { ...validAnalysis(), documentStructure: { options: [] } }
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects when dateFormats.detected is empty', () => {
    const data = { ...validAnalysis(), dateFormats: { detected: [] } }
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects when missing required fields', () => {
    const result = aiAnalysisSchema.safeParse({ documentStructure: { options: [] } })
    expect(result.success).toBe(false)
  })

  it('rejects invalid confidence level', () => {
    const data = validAnalysis()
    data.locations.candidates = [{ name: 'X', confidence: 'very_high' as 'high', source: 'X' }]
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('accepts empty candidates arrays', () => {
    const data = validAnalysis()
    data.locations.candidates = []
    data.statusCodes.candidates = []
    data.eventNames.candidates = []
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts null detectedTimezone', () => {
    const data = { ...validAnalysis(), detectedTimezone: null }
    const result = aiAnalysisSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('correctionResponseSchema', () => {
  it('accepts a valid correction response', () => {
    const data = [
      {
        field: 'name',
        alternatives: [
          { label: 'First line', value: 'first_line' },
          { label: 'After date', value: 'after_date' },
        ],
      },
    ]
    const result = correctionResponseSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('accepts an empty array', () => {
    const result = correctionResponseSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('accepts multiple correction fields', () => {
    const data = [
      { field: 'name', alternatives: [{ label: 'A', value: 'a' }] },
      { field: 'dates', alternatives: [{ label: 'B', value: 'b' }] },
    ]
    const result = correctionResponseSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects when alternatives is missing', () => {
    const result = correctionResponseSchema.safeParse([{ field: 'name' }])
    expect(result.success).toBe(false)
  })

  it('rejects non-array input', () => {
    const result = correctionResponseSchema.safeParse({ field: 'name' })
    expect(result.success).toBe(false)
  })
})

describe('unrecognizedFormatSchema', () => {
  it('accepts a valid unrecognized_format error', () => {
    const data = {
      error: 'unrecognized_format',
      message: 'Not calendar data',
    }
    const result = unrecognizedFormatSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects other error types', () => {
    const data = { error: 'other_error', message: 'Something else' }
    const result = unrecognizedFormatSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects when message is missing', () => {
    const result = unrecognizedFormatSchema.safeParse({ error: 'unrecognized_format' })
    expect(result.success).toBe(false)
  })
})
