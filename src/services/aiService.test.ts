import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { analyzeDocument, getCorrectionSuggestions, AiServiceError } from './aiService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid analysis response from the Worker proxy. */
function validAnalysisResponse() {
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
    suggestedTemplateName: 'Tech Conference Calendar',
  }
}

/** Minimal valid correction response from the Worker proxy. */
function validCorrectionResponse() {
  return [
    {
      field: 'name',
      alternatives: [
        { label: 'First line', value: 'first_line' },
        { label: 'After date', value: 'after_date' },
      ],
    },
  ]
}

const SAMPLE_TEXT = 'Annual Tech Conference\nMarch 15-17, 2026\nHall A\nStatus: Confirmed'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aiService', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('analyzeDocument', () => {
    it('returns validated analysis on success', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(validAnalysisResponse()), { status: 200 })
      )

      const result = await analyzeDocument(SAMPLE_TEXT, 'token-123')
      expect(result.documentStructure.options).toHaveLength(1)
      expect(result.suggestedTemplateName).toBe('Tech Conference Calendar')
    })

    it('sends correct request payload', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(validAnalysisResponse()), { status: 200 })
      )

      await analyzeDocument(SAMPLE_TEXT, 'token-abc')

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, opts] = fetchSpy.mock.calls[0]
      expect(url).toContain('/api/analyze')
      const body = JSON.parse(opts!.body as string)
      expect(body.calendarText).toBe(SAMPLE_TEXT)
      expect(body.action).toBe('initial_analysis')
      expect(body.turnstileToken).toBe('token-abc')
    })

    it('throws unrecognized_format for non-calendar text', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'unrecognized_format',
            message: 'Not calendar data',
          }),
          { status: 200 }
        )
      )

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('unrecognized_format')
      }
    })

    it('throws generic error for malformed AI response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ unexpected: true }), { status: 200 })
      )

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('generic')
      }
    })

    it('throws rate_limited for 429 response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
      )

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('rate_limited')
      }
    })

    it('throws rate_limited for 503 response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 })
      )

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('rate_limited')
      }
    })

    it('throws api_down for 502 response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'AI error' }), { status: 502 })
      )

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('api_down')
      }
    })

    it('throws api_down for network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('api_down')
      }
    })

    it('throws timeout for AbortError', async () => {
      fetchSpy.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

      try {
        await analyzeDocument(SAMPLE_TEXT, 'tok')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('timeout')
      }
    })

    it('invokes onTick callback every second', async () => {
      vi.useFakeTimers()

      // Delay the fetch response so ticks fire
      fetchSpy.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify(validAnalysisResponse()), { status: 200 }))
          }, 3500)
        })
      })

      const ticks: number[] = []
      const promise = analyzeDocument(SAMPLE_TEXT, 'tok', (elapsed) => {
        ticks.push(elapsed)
      })

      // Advance 3 seconds
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(500) // resolve fetch

      await promise

      expect(ticks).toEqual([1, 2, 3])

      vi.useRealTimers()
    })
  })

  describe('getCorrectionSuggestions', () => {
    it('returns validated corrections on success', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(validCorrectionResponse()), { status: 200 })
      )

      const result = await getCorrectionSuggestions('raw text', ['name'], 'tok')
      expect(result).toHaveLength(1)
      expect(result[0].field).toBe('name')
    })

    it('sends correction action in payload', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(validCorrectionResponse()), { status: 200 })
      )

      await getCorrectionSuggestions('raw text', ['name', 'dates'], 'tok')

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body.action).toBe('correction')
      expect(body.calendarText).toBe('raw text')
      expect(body.corrections.flaggedFields).toEqual(['name', 'dates'])
    })

    it('throws generic for malformed correction response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ wrong: 'format' }), { status: 200 })
      )

      try {
        await getCorrectionSuggestions('text', ['name'], 'tok')
      } catch (err) {
        expect(err).toBeInstanceOf(AiServiceError)
        expect((err as AiServiceError).errorType).toBe('generic')
      }
    })
  })
})
