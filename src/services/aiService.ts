import type { AiAnalysis, CorrectionAlternative } from '../hooks/useWizardReducer'
import {
  aiAnalysisSchema,
  correctionResponseSchema,
  unrecognizedFormatSchema,
} from '../schemas/aiResponseSchema'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Worker proxy URL from environment. Falls back to empty string (relative). */
const API_URL = import.meta.env.VITE_API_URL || ''

/** Timeout for the overall fetch request (ms). */
const REQUEST_TIMEOUT_MS = 60_000

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Error subclass carrying a typed error code for the wizard to display. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly errorType: 'rate_limited' | 'api_down' | 'unrecognized_format' | 'timeout' | 'generic'
  ) {
    super(message)
    this.name = 'AiServiceError'
  }
}

// ---------------------------------------------------------------------------
// Timeout callback support
// ---------------------------------------------------------------------------

/**
 * Callback invoked during a request to report elapsed seconds.
 * The WizardPage uses this to show progressive timeout messages.
 */
export type TimeoutTickCallback = (elapsedSeconds: number) => void

/** Options shared by all AI service calls. */
export interface AiCallOptions {
  /** Callback invoked every second with elapsed time. */
  onTick?: TimeoutTickCallback
  /** External AbortSignal to cancel the request (e.g., user cancels). */
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze extracted PDF text via the Cloudflare Worker proxy.
 * Returns structured AI suggestions for the wizard quiz.
 *
 * @param text - Extracted PDF text
 * @param turnstileToken - One-time Turnstile verification token
 * @param options - Optional tick callback and abort signal
 * @returns Validated AiAnalysis
 * @throws {AiServiceError} On network, validation, or business-logic errors
 */
export async function analyzeDocument(
  text: string,
  turnstileToken: string,
  options?: AiCallOptions | TimeoutTickCallback
): Promise<AiAnalysis> {
  const opts = normalizeOptions(options)
  const data = await callWorker(
    {
      calendarText: text,
      action: 'initial_analysis',
      turnstileToken,
    },
    opts
  )

  // Check for unrecognized_format error from Gemini
  const unrecognized = unrecognizedFormatSchema.safeParse(data)
  if (unrecognized.success) {
    throw new AiServiceError(
      unrecognized.data.message,
      'unrecognized_format'
    )
  }

  // Validate against the analysis schema
  const parsed = aiAnalysisSchema.safeParse(data)
  if (!parsed.success) {
    throw new AiServiceError(
      'The AI returned an unexpected response format. Please try again.',
      'generic'
    )
  }

  return parsed.data
}

/**
 * Get correction alternatives for flagged event fields.
 *
 * @param rawText - The event's raw text from the PDF
 * @param issues - Array of field names flagged as incorrect
 * @param turnstileToken - One-time Turnstile verification token
 * @param currentProfile - The current template profile for context
 * @param options - Optional tick callback and abort signal
 * @returns Array of correction alternatives
 * @throws {AiServiceError} On network, validation, or business-logic errors
 */
export async function getCorrectionSuggestions(
  rawText: string,
  issues: string[],
  turnstileToken: string,
  currentProfile?: Record<string, unknown>,
  options?: AiCallOptions | TimeoutTickCallback
): Promise<CorrectionAlternative[]> {
  const opts = normalizeOptions(options)
  const data = await callWorker(
    {
      calendarText: rawText,
      action: 'correction',
      turnstileToken,
      currentProfile: currentProfile ?? {},
      corrections: { flaggedFields: issues },
    },
    opts
  )

  const parsed = correctionResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new AiServiceError(
      'The AI returned an unexpected correction format. Please try again.',
      'generic'
    )
  }

  return parsed.data
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize the options parameter — accepts either a callback (for backward
 * compatibility with tests) or an options object.
 */
function normalizeOptions(
  options?: AiCallOptions | TimeoutTickCallback
): AiCallOptions {
  if (!options) return {}
  if (typeof options === 'function') return { onTick: options }
  return options
}

/**
 * Makes a POST request to the Worker proxy with timeout, tick tracking,
 * and external abort signal support.
 *
 * @param body - Request payload
 * @param options - Tick callback and/or abort signal
 * @returns Parsed JSON response data
 * @throws {AiServiceError} On any failure
 */
async function callWorker(
  body: Record<string, unknown>,
  options: AiCallOptions
): Promise<unknown> {
  const { onTick, signal: externalSignal } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Link external signal: if the caller aborts, abort our controller too
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      throw new AiServiceError(
        'The request was cancelled.',
        'timeout'
      )
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  // Tick timer: fires every second so the UI can show progressive messages
  let tickInterval: ReturnType<typeof setInterval> | undefined
  if (onTick) {
    let elapsed = 0
    tickInterval = setInterval(() => {
      elapsed += 1
      onTick(elapsed)
    }, 1000)
  }

  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw await buildErrorFromResponse(response)
    }

    return await response.json()
  } catch (err) {
    clearTimeout(timeoutId)

    if (err instanceof AiServiceError) {
      throw err
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AiServiceError(
        'The request timed out. Please try again.',
        'timeout'
      )
    }

    throw new AiServiceError(
      'Unable to reach the AI service. Please check your connection and try again.',
      'api_down'
    )
  } finally {
    if (tickInterval) {
      clearInterval(tickInterval)
    }
  }
}

/**
 * Maps an HTTP error response to a typed AiServiceError.
 */
async function buildErrorFromResponse(response: Response): Promise<AiServiceError> {
  let message: string
  try {
    const json = await response.json()
    message = json.error || response.statusText
  } catch {
    message = response.statusText
  }

  switch (response.status) {
    case 429:
      return new AiServiceError(message, 'rate_limited')
    case 503:
      return new AiServiceError(message, 'rate_limited')
    case 502:
      return new AiServiceError(message, 'api_down')
    default:
      return new AiServiceError(message, 'generic')
  }
}
