import { z } from 'zod'

// ---------------------------------------------------------------------------
// AI Analysis response schema (spec 4.4 — initial_analysis action)
// ---------------------------------------------------------------------------

/** Schema for a single option in an analysis category. */
const aiOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  source: z.string(),
})

/** Schema for a detected date format. */
const aiDateFormatSchema = z.object({
  label: z.string(),
  pattern: z.string(),
  format: z.string().optional(),
  examples: z.array(z.string()),
  source: z.string(),
})

/** Schema for a candidate with confidence level. */
const aiCandidateSchema = z.object({
  name: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  source: z.string(),
})

/** Schema for an event name candidate. */
const aiEventNameCandidateSchema = z.object({
  name: z.string(),
  source: z.string(),
})

/**
 * Zod schema for the full AI analysis response (initial_analysis action).
 * Validates the JSON returned by Gemini via the Worker proxy.
 */
export const aiAnalysisSchema = z.object({
  documentStructure: z.object({ options: z.array(aiOptionSchema).min(1) }),
  dateFormats: z.object({ detected: z.array(aiDateFormatSchema).min(1) }),
  locations: z.object({ candidates: z.array(aiCandidateSchema) }),
  statusCodes: z.object({ candidates: z.array(aiCandidateSchema) }),
  eventNames: z.object({ candidates: z.array(aiEventNameCandidateSchema) }),
  estimatedEventCount: z.number(),
  detectedTimezone: z.string().nullable(),
  notes: z.string().nullable(),
  suggestedTemplateName: z.string().nullable().optional(),
})

// ---------------------------------------------------------------------------
// Correction response schema (spec 4.4 — correction action)
// ---------------------------------------------------------------------------

/** Schema for a single correction alternative set. */
const correctionAlternativeSchema = z.object({
  field: z.string(),
  alternatives: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ),
})

/**
 * Zod schema for the correction response from Gemini.
 * Returns an array of correction alternatives per flagged field.
 */
export const correctionResponseSchema = z.array(correctionAlternativeSchema)

// ---------------------------------------------------------------------------
// Unrecognized format error schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for the unrecognized_format error returned by Gemini
 * when the input text doesn't appear to contain calendar data.
 */
export const unrecognizedFormatSchema = z.object({
  error: z.literal('unrecognized_format'),
  message: z.string(),
})
