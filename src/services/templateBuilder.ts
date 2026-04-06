import type { ProfileTemplate } from '../schemas/templateSchema'
import { templateSchema } from '../schemas/templateSchema'
import type { AiAnalysis, WizardAnswers } from '../hooks/useWizardReducer'

/**
 * Build a ProfileTemplate from wizard answers and AI analysis.
 * Validates the result against the Zod schema before returning.
 *
 * @param name - User-provided template name
 * @param answers - Accumulated wizard answers
 * @param analysis - AI analysis results (used for defaults when steps are skipped)
 * @returns A validated ProfileTemplate ready for use
 * @throws If the assembled template fails Zod validation
 */
export function buildTemplate(
  name: string,
  answers: WizardAnswers,
  analysis: AiAnalysis
): ProfileTemplate {
  const template: ProfileTemplate = {
    name: name || 'Untitled Template',
    version: '1.0',
    author: 'AI Wizard',
    source: 'wizard',
    created: new Date().toISOString(),
    structure: buildStructure(answers, analysis),
    dateFormats: buildDateFormats(answers, analysis),
    fields: buildFields(answers, analysis),
    timezone: answers.timezone ?? analysis.detectedTimezone ?? null,
  }

  return templateSchema.parse(template)
}

/**
 * Build the structure configuration from wizard answers.
 */
function buildStructure(
  answers: WizardAnswers,
  analysis: AiAnalysis
): ProfileTemplate['structure'] {
  const type = resolveStructureType(answers.documentStructure, analysis)

  switch (type) {
    case 'table':
      return {
        type: 'table',
        tableHeaders: ['Event', 'Date', 'Location', 'Status'],
      }
    case 'list':
      return {
        type: 'list',
        linePattern:
          '(?<name>.+?)\\s*[-–—]\\s*(?<date>\\d{1,2}/\\d{1,2}/\\d{2,4})',
      }
    case 'block':
    default:
      return {
        type: 'block',
        blockDelimiter: '\\n{2,}',
      }
  }
}

/**
 * Resolve the structure type from the user's answer or AI best guess.
 */
function resolveStructureType(
  answer: string | null,
  analysis: AiAnalysis
): 'block' | 'table' | 'list' {
  if (answer === 'block' || answer === 'table' || answer === 'list') {
    return answer
  }
  // Fallback: pick the first AI option
  const firstOption = analysis.documentStructure.options[0]
  if (
    firstOption &&
    (firstOption.value === 'block' ||
      firstOption.value === 'table' ||
      firstOption.value === 'list')
  ) {
    return firstOption.value
  }
  return 'block'
}

/**
 * Build date format configurations from wizard answers.
 */
function buildDateFormats(
  answers: WizardAnswers,
  analysis: AiAnalysis
): ProfileTemplate['dateFormats'] {
  if (answers.dateFormat) {
    return [
      {
        pattern: answers.dateFormat.pattern,
        format: answers.dateFormat.format,
        fields: ['startDate'] as ProfileTemplate['dateFormats'][0]['fields'],
      },
    ]
  }

  // Fallback: use first AI-detected format
  const first = analysis.dateFormats.detected[0]
  if (first) {
    return [
      {
        pattern: first.pattern,
        format: first.format,
        fields: ['startDate'] as ProfileTemplate['dateFormats'][0]['fields'],
      },
    ]
  }

  // Last resort: common US date pattern
  return [
    {
      pattern: '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{2,4})',
      format: 'MM/DD/YYYY',
      fields: ['startDate'] as ProfileTemplate['dateFormats'][0]['fields'],
    },
  ]
}

/**
 * Build field extraction configuration from wizard answers.
 */
function buildFields(
  answers: WizardAnswers,
  analysis: AiAnalysis
): ProfileTemplate['fields'] {
  const fields: ProfileTemplate['fields'] = {}

  // Event name position
  if (answers.eventNamePosition) {
    const position = answers.eventNamePosition as
      | 'first_line'
      | 'after_date'
      | 'before_date'
      | 'regex'
    fields.eventName = { position }
  }

  // Locations
  if (answers.locations.length > 0) {
    fields.location = { knownValues: answers.locations }
  } else {
    // Use high-confidence AI candidates as fallback
    const highConf = analysis.locations.candidates
      .filter((c) => c.confidence === 'high')
      .map((c) => c.name)
    if (highConf.length > 0) {
      fields.location = { knownValues: highConf }
    }
  }

  // Status codes
  if (answers.statusCodes.length > 0) {
    fields.status = { knownValues: answers.statusCodes }
  } else {
    const highConf = analysis.statusCodes.candidates
      .filter((c) => c.confidence === 'high')
      .map((c) => c.name)
    if (highConf.length > 0) {
      fields.status = { knownValues: highConf }
    }
  }

  return fields
}
