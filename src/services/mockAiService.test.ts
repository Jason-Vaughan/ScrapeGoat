import { describe, expect, it } from 'vitest'
import { analyzeDocument, getCorrectionSuggestions } from './mockAiService'

describe('mockAiService', () => {
  describe('analyzeDocument', () => {
    it('returns a valid AiAnalysis object', async () => {
      const result = await analyzeDocument('Sample calendar text March 15, 2026')
      expect(result.documentStructure.options).toHaveLength(3)
      expect(result.dateFormats.detected.length).toBeGreaterThan(0)
      expect(result.locations.candidates.length).toBeGreaterThan(0)
      expect(result.statusCodes.candidates.length).toBeGreaterThan(0)
      expect(result.eventNames.candidates.length).toBeGreaterThan(0)
      expect(result.estimatedEventCount).toBeGreaterThan(0)
    })

    it('detects long-form date patterns in text', async () => {
      const result = await analyzeDocument(
        'Event on March 15, 2026 and April 22, 2026'
      )
      const longFormat = result.dateFormats.detected.find(
        (d) => d.format === 'Month DD, YYYY'
      )
      expect(longFormat).toBeDefined()
      expect(longFormat!.examples.length).toBeGreaterThan(0)
    })

    it('detects slash date patterns', async () => {
      const result = await analyzeDocument('Event on 03/15/2026')
      const slashFormat = result.dateFormats.detected.find(
        (d) => d.format === 'MM/DD/YYYY'
      )
      expect(slashFormat).toBeDefined()
    })

    it('detects ISO date patterns', async () => {
      const result = await analyzeDocument('Event on 2026-03-15')
      const isoFormat = result.dateFormats.detected.find(
        (d) => d.format === 'YYYY-MM-DD'
      )
      expect(isoFormat).toBeDefined()
    })

    it('always includes DD/MM/YYYY international fallback', async () => {
      const result = await analyzeDocument('No dates here')
      const intl = result.dateFormats.detected.find(
        (d) => d.format === 'DD/MM/YYYY'
      )
      expect(intl).toBeDefined()
    })

    it('throws with errorType on simulated rate_limited', async () => {
      await expect(
        analyzeDocument('text', 'rate_limited')
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('throws with errorType on simulated api_down', async () => {
      await expect(
        analyzeDocument('text', 'api_down')
      ).rejects.toThrow('AI service is temporarily unavailable')
    })

    it('throws with errorType on simulated generic error', async () => {
      await expect(
        analyzeDocument('text', 'generic')
      ).rejects.toThrow('unexpected error')
    })

    it('structure options include block, table, list', async () => {
      const result = await analyzeDocument('sample')
      const values = result.documentStructure.options.map((o) => o.value)
      expect(values).toContain('block')
      expect(values).toContain('table')
      expect(values).toContain('list')
    })
  })

  describe('getCorrectionSuggestions', () => {
    it('returns alternatives for each flagged issue', async () => {
      const result = await getCorrectionSuggestions('raw event text', [
        'dates',
        'location',
      ])
      expect(result).toHaveLength(2)
      expect(result[0].field).toBe('dates')
      expect(result[1].field).toBe('location')
    })

    it('each alternative has at least 2 options', async () => {
      const result = await getCorrectionSuggestions('raw text', ['name'])
      expect(result[0].alternatives.length).toBeGreaterThanOrEqual(2)
    })

    it('throws on simulated error', async () => {
      await expect(
        getCorrectionSuggestions('text', ['dates'], 'rate_limited')
      ).rejects.toThrow()
    })

    it('handles unknown field types gracefully', async () => {
      const result = await getCorrectionSuggestions('text', ['unknown_field'])
      expect(result[0].field).toBe('unknown_field')
      expect(result[0].alternatives.length).toBeGreaterThan(0)
    })
  })
})
