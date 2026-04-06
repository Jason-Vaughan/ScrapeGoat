import type { AiAnalysis, CorrectionAlternative } from '../hooks/useWizardReducer'

/** Simulated error type for testing graceful degradation. */
export type SimulatedError = 'rate_limited' | 'api_down' | 'generic'

/** Artificial delay to simulate network latency (ms). */
const MOCK_DELAY = 1500

/**
 * Analyze extracted PDF text and return structured AI suggestions.
 * Currently returns hardcoded mock data. Will be replaced by Gemini API in Chunk 10.
 *
 * @param text - Extracted PDF text
 * @param __simulateError - Optional error type for testing graceful degradation
 */
export async function analyzeDocument(
  text: string,
  __simulateError?: SimulatedError
): Promise<AiAnalysis> {
  await delay(MOCK_DELAY)

  if (__simulateError) {
    throw createSimulatedError(__simulateError)
  }

  return buildMockAnalysis(text)
}

/**
 * Get correction alternatives for a flagged event's fields.
 * Returns radio options the user can pick from.
 *
 * @param rawText - The event's raw text from the PDF
 * @param issues - Array of field names that are flagged as incorrect
 * @param __simulateError - Optional error type for testing
 */
export async function getCorrectionSuggestions(
  rawText: string,
  issues: string[],
  __simulateError?: SimulatedError
): Promise<CorrectionAlternative[]> {
  await delay(MOCK_DELAY)

  if (__simulateError) {
    throw createSimulatedError(__simulateError)
  }

  return issues.map((field) => buildCorrectionAlternatives(field, rawText))
}

// ---------------------------------------------------------------------------
// Mock data builders
// ---------------------------------------------------------------------------

/**
 * Build a mock analysis result based on superficial inspection of the text.
 */
function buildMockAnalysis(text: string): AiAnalysis {
  const hasTablePatterns = /\t|\|/.test(text)
  const hasListPatterns = /^\s*[-•●]\s/m.test(text)

  const structureOptions = [
    {
      label: 'Events in separate blocks with dates and details',
      value: 'block',
      source: getSnippet(text, 0, 120),
    },
    {
      label: 'Table or grid with rows and columns',
      value: 'table',
      source: hasTablePatterns ? getSnippet(text, 0, 120) : 'No table patterns detected',
    },
    {
      label: 'Simple list, one event per line',
      value: 'list',
      source: hasListPatterns ? getSnippet(text, 0, 120) : 'No list patterns detected',
    },
  ]

  const dateFormats = detectMockDateFormats(text)

  return {
    documentStructure: { options: structureOptions },
    dateFormats: { detected: dateFormats },
    locations: {
      candidates: [
        { name: 'Main Hall', confidence: 'high', source: 'Main Hall — Event Setup' },
        { name: 'Conference Room A', confidence: 'high', source: 'Conference Room A' },
        { name: 'Exhibit Hall B', confidence: 'medium', source: '...in Exhibit Hall B...' },
        { name: 'Outdoor Plaza', confidence: 'low', source: '...outdoor plaza area...' },
      ],
    },
    statusCodes: {
      candidates: [
        { name: 'Confirmed', confidence: 'high', source: 'Status: Confirmed' },
        { name: 'Tentative', confidence: 'high', source: 'Status: Tentative' },
        { name: 'Hold', confidence: 'medium', source: '(Hold)' },
        { name: 'Canceled', confidence: 'low', source: 'CANCELED' },
      ],
    },
    eventNames: {
      candidates: [
        { name: 'Annual Tech Conference 2026', source: 'Annual Tech Conference 2026\nMarch 15-17...' },
        { name: 'Spring Trade Show', source: 'Spring Trade Show\nApril 22-24...' },
        { name: 'Board Meeting Q2', source: 'Board Meeting Q2\nMay 1...' },
      ],
    },
    estimatedEventCount: 47,
    detectedTimezone: 'America/New_York',
    notes: 'Document appears to be a venue event calendar with block-style layout.',
  }
}

/**
 * Detect mock date formats by scanning for common patterns.
 */
function detectMockDateFormats(text: string): AiAnalysis['dateFormats']['detected'] {
  const formats: AiAnalysis['dateFormats']['detected'] = []

  // Check for MM/DD/YYYY
  const slashDates = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g)
  if (slashDates && slashDates.length > 0) {
    formats.push({
      label: 'MM/DD/YYYY (US format)',
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
      format: 'MM/DD/YYYY',
      examples: slashDates.slice(0, 3),
      source: slashDates.slice(0, 2).join(', '),
    })
  }

  // Check for Month DD, YYYY
  const longDates = text.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
  )
  if (longDates && longDates.length > 0) {
    formats.push({
      label: 'Month DD, YYYY (e.g., "March 5, 2026")',
      pattern:
        '(?<month>January|February|March|April|May|June|July|August|September|October|November|December)\\s+(?<day>\\d{1,2}),?\\s+(?<year>\\d{4})',
      format: 'Month DD, YYYY',
      examples: longDates.slice(0, 3),
      source: longDates.slice(0, 2).join(', '),
    })
  }

  // Check for YYYY-MM-DD (ISO)
  const isoDates = text.match(/\d{4}-\d{2}-\d{2}/g)
  if (isoDates && isoDates.length > 0) {
    formats.push({
      label: 'YYYY-MM-DD (ISO format)',
      pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})',
      format: 'YYYY-MM-DD',
      examples: isoDates.slice(0, 3),
      source: isoDates.slice(0, 2).join(', '),
    })
  }

  // Always include fallback options
  if (formats.length === 0) {
    formats.push({
      label: 'MM/DD/YYYY (US format)',
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
      format: 'MM/DD/YYYY',
      examples: ['03/15/2026', '04/22/2026'],
      source: 'No dates detected — using common US format',
    })
  }

  formats.push({
    label: 'DD/MM/YYYY (International format)',
    pattern: '(?<day>\\d{1,2})/(?<month>\\d{1,2})/(?<year>\\d{2,4})',
    format: 'DD/MM/YYYY',
    examples: ['15/03/2026', '22/04/2026'],
    source: 'Alternative interpretation of slash-separated dates',
  })

  return formats
}

/**
 * Build correction alternatives for a single flagged field.
 */
function buildCorrectionAlternatives(
  field: string,
  _rawText: string
): CorrectionAlternative {
  switch (field) {
    case 'name':
      return {
        field: 'name',
        alternatives: [
          { label: 'Use first line of block as name', value: 'first_line' },
          { label: 'Use text after date as name', value: 'after_date' },
          { label: 'Use text before date as name', value: 'before_date' },
        ],
      }
    case 'dates':
      return {
        field: 'dates',
        alternatives: [
          { label: 'March 15-17, 2026', value: '2026-03-15' },
          { label: 'March 15, 2026 (single day)', value: '2026-03-15-single' },
          { label: '03/15/2026 – 03/17/2026', value: '2026-03-15-to-17' },
        ],
      }
    case 'location':
      return {
        field: 'location',
        alternatives: [
          { label: 'Main Hall', value: 'Main Hall' },
          { label: 'Hall A', value: 'Hall A' },
          { label: 'Conference Center', value: 'Conference Center' },
        ],
      }
    case 'status':
      return {
        field: 'status',
        alternatives: [
          { label: 'Confirmed', value: 'Confirmed' },
          { label: 'Tentative', value: 'Tentative' },
          { label: 'Hold', value: 'Hold' },
        ],
      }
    default:
      return {
        field,
        alternatives: [
          { label: 'Option A', value: 'option_a' },
          { label: 'Option B', value: 'option_b' },
        ],
      }
  }
}

/**
 * Extract a text snippet starting at a given position.
 */
function getSnippet(text: string, start: number, maxLength: number): string {
  const snippet = text.slice(start, start + maxLength).trim()
  return snippet.length < text.slice(start).trim().length
    ? snippet + '…'
    : snippet
}

/**
 * Create a simulated error for testing graceful degradation.
 */
function createSimulatedError(type: SimulatedError): Error {
  const messages: Record<SimulatedError, string> = {
    rate_limited: 'Rate limit exceeded. Please try again later.',
    api_down: 'AI service is temporarily unavailable.',
    generic: 'An unexpected error occurred during analysis.',
  }
  const error = new Error(messages[type])
  ;(error as Error & { errorType: string }).errorType = type
  return error
}

/**
 * Promise-based delay utility.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
