import { useReducer } from 'react'
import type { ParsedEvent } from '../services/parser'

// ---------------------------------------------------------------------------
// AI Analysis types (matches spec 4.4 response schema)
// ---------------------------------------------------------------------------

/** A single option in an AI analysis category. */
export interface AiOption {
  label: string
  value: string
  source: string
}

/** A detected date format from AI analysis. */
export interface AiDateFormat {
  label: string
  pattern: string
  format?: string
  examples: string[]
  source: string
}

/** A candidate with confidence level from AI analysis. */
export interface AiCandidate {
  name: string
  confidence: 'high' | 'medium' | 'low'
  source: string
}

/** An event name candidate from AI analysis. */
export interface AiEventNameCandidate {
  name: string
  source: string
}

/** Full AI analysis response for a document. */
export interface AiAnalysis {
  documentStructure: { options: AiOption[] }
  dateFormats: { detected: AiDateFormat[] }
  locations: { candidates: AiCandidate[] }
  statusCodes: { candidates: AiCandidate[] }
  eventNames: { candidates: AiEventNameCandidate[] }
  estimatedEventCount: number
  detectedTimezone: string | null
  notes: string | null
  suggestedTemplateName?: string | null
}

/** Correction alternative offered by AI for a flagged field. */
export interface CorrectionAlternative {
  field: string
  alternatives: { label: string; value: string }[]
}

// ---------------------------------------------------------------------------
// Wizard state types
// ---------------------------------------------------------------------------

/** Ordered wizard step identifiers. */
export type WizardStepId =
  | 'loading'
  | 'documentStructure'
  | 'dateFormat'
  | 'timezone'
  | 'locations'
  | 'statusCodes'
  | 'eventNames'
  | 'reviewTest'
  | 'correction'
  | 'saveTemplate'
  | 'failure'

/** User answers accumulated through the quiz. */
export interface WizardAnswers {
  documentStructure: string | null
  dateFormat: { pattern: string; format?: string } | null
  timezone: string | null
  locations: string[]
  statusCodes: string[]
  eventNamePosition: string | null
}

/** A flagged event awaiting correction. */
export interface FlaggedEvent {
  eventId: string
  issues: string[]
  correctionRound: number
  resolved: boolean
  corrections: CorrectionAlternative[]
}

/** Error types for graceful degradation. */
export interface WizardError {
  type: 'rate_limited' | 'api_down' | 'unrecognized_format' | 'timeout' | 'generic'
  message: string
}

/** Full wizard state. */
export interface WizardState {
  currentStep: WizardStepId
  aiAnalysis: AiAnalysis | null
  answers: WizardAnswers
  loading: boolean
  loadingTip: string
  elapsedSeconds: number
  error: WizardError | null
  testParseResults: ParsedEvent[]
  flaggedEvents: FlaggedEvent[]
  currentFlaggedIndex: number
  templateName: string
  suggestedTemplateName: string | null
  saveOptions: { browser: boolean; download: boolean; share: boolean }
  cancelDialogOpen: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Quiz steps that show the progress bar (Step X of 6). */
export const QUIZ_STEPS: WizardStepId[] = [
  'documentStructure',
  'dateFormat',
  'timezone',
  'locations',
  'statusCodes',
  'eventNames',
]

/** Maximum correction rounds per flagged event. */
export const MAX_CORRECTION_ROUNDS = 3

/** Loading tip messages that rotate during AI analysis. */
export const LOADING_TIPS = [
  'Scanning document structure…',
  'Looking for date patterns…',
  'Identifying locations…',
  'Detecting status codes…',
  'Analyzing event layout…',
]

/** Initial wizard answers (all null/empty). */
const INITIAL_ANSWERS: WizardAnswers = {
  documentStructure: null,
  dateFormat: null,
  timezone: null,
  locations: [],
  statusCodes: [],
  eventNamePosition: null,
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Actions that modify wizard state. */
export type WizardAction =
  | { type: 'ANALYSIS_START' }
  | { type: 'ANALYSIS_SUCCESS'; payload: AiAnalysis }
  | { type: 'ANALYSIS_FAILURE'; payload: WizardError }
  | { type: 'SET_STRUCTURE'; payload: string }
  | { type: 'SET_DATE_FORMAT'; payload: { pattern: string; format?: string } }
  | { type: 'SET_TIMEZONE'; payload: string }
  | { type: 'SET_LOCATIONS'; payload: string[] }
  | { type: 'SET_STATUS_CODES'; payload: string[] }
  | { type: 'SET_EVENT_NAME_POSITION'; payload: string }
  | { type: 'SET_TEMPLATE_NAME'; payload: string }
  | { type: 'SET_SAVE_OPTIONS'; payload: Partial<WizardState['saveOptions']> }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SKIP_STEP' }
  | { type: 'GO_TO_STEP'; payload: WizardStepId }
  | { type: 'SET_TEST_RESULTS'; payload: ParsedEvent[] }
  | { type: 'FLAG_EVENTS'; payload: FlaggedEvent[] }
  | { type: 'SET_CORRECTIONS'; payload: { eventId: string; corrections: CorrectionAlternative[] } }
  | { type: 'RESOLVE_FLAG'; payload: string }
  | { type: 'ADVANCE_FLAGGED' }
  | { type: 'SET_ELAPSED'; payload: number }
  | { type: 'SET_SUGGESTED_NAME'; payload: string }
  | { type: 'TOGGLE_CANCEL_DIALOG' }
  | { type: 'RETRY' }
  | { type: 'START_OVER' }

// ---------------------------------------------------------------------------
// Step navigation helpers
// ---------------------------------------------------------------------------

/** Ordered list of all wizard steps for navigation. */
const STEP_ORDER: WizardStepId[] = [
  'loading',
  'documentStructure',
  'dateFormat',
  'timezone',
  'locations',
  'statusCodes',
  'eventNames',
  'reviewTest',
  'correction',
  'saveTemplate',
  'failure',
]

/**
 * Get the next step after the current one.
 * Skips 'correction' (entered only via flagging) and 'failure' (entered only on error).
 */
function getNextStep(current: WizardStepId): WizardStepId {
  const idx = STEP_ORDER.indexOf(current)
  if (idx === -1) return current
  // After eventNames, go to reviewTest (skip correction/failure)
  if (current === 'eventNames') return 'reviewTest'
  // After reviewTest, go to saveTemplate (correction entered separately)
  if (current === 'reviewTest') return 'saveTemplate'
  const next = STEP_ORDER[idx + 1]
  if (!next || next === 'correction' || next === 'failure') return current
  return next
}

/**
 * Get the previous step before the current one.
 * Skips 'loading', 'correction', and 'failure'.
 */
function getPrevStep(current: WizardStepId): WizardStepId {
  const idx = STEP_ORDER.indexOf(current)
  if (idx <= 1) return current // Can't go back from loading or first quiz step
  // From reviewTest, go back to eventNames
  if (current === 'reviewTest') return 'eventNames'
  // From saveTemplate, go back to reviewTest
  if (current === 'saveTemplate') return 'reviewTest'
  const prev = STEP_ORDER[idx - 1]
  if (!prev || prev === 'loading') return current
  return prev
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/** Create the initial wizard state. */
export function createInitialState(): WizardState {
  return {
    currentStep: 'loading',
    aiAnalysis: null,
    answers: { ...INITIAL_ANSWERS },
    loading: true,
    loadingTip: LOADING_TIPS[0],
    elapsedSeconds: 0,
    error: null,
    testParseResults: [],
    flaggedEvents: [],
    currentFlaggedIndex: 0,
    templateName: '',
    suggestedTemplateName: null,
    saveOptions: { browser: true, download: false, share: false },
    cancelDialogOpen: false,
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Reducer for wizard state management.
 * Handles step navigation, answer collection, correction flow, and error states.
 */
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'ANALYSIS_START':
      return {
        ...state,
        currentStep: 'loading',
        loading: true,
        elapsedSeconds: 0,
        error: null,
        loadingTip: LOADING_TIPS[0],
      }

    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        currentStep: 'documentStructure',
        aiAnalysis: action.payload,
        loading: false,
        error: null,
      }

    case 'ANALYSIS_FAILURE':
      return {
        ...state,
        currentStep: 'failure',
        loading: false,
        error: action.payload,
      }

    case 'SET_STRUCTURE':
      return {
        ...state,
        answers: { ...state.answers, documentStructure: action.payload },
      }

    case 'SET_DATE_FORMAT':
      return {
        ...state,
        answers: { ...state.answers, dateFormat: action.payload },
      }

    case 'SET_TIMEZONE':
      return {
        ...state,
        answers: { ...state.answers, timezone: action.payload },
      }

    case 'SET_LOCATIONS':
      return {
        ...state,
        answers: { ...state.answers, locations: action.payload },
      }

    case 'SET_STATUS_CODES':
      return {
        ...state,
        answers: { ...state.answers, statusCodes: action.payload },
      }

    case 'SET_EVENT_NAME_POSITION':
      return {
        ...state,
        answers: { ...state.answers, eventNamePosition: action.payload },
      }

    case 'SET_TEMPLATE_NAME':
      return { ...state, templateName: action.payload }

    case 'SET_SAVE_OPTIONS':
      return {
        ...state,
        saveOptions: { ...state.saveOptions, ...action.payload },
      }

    case 'NEXT_STEP':
      return { ...state, currentStep: getNextStep(state.currentStep) }

    case 'PREV_STEP':
      return { ...state, currentStep: getPrevStep(state.currentStep) }

    case 'SKIP_STEP': {
      // Clear the answer for the current step, then advance
      const cleared = clearStepAnswer(state.answers, state.currentStep)
      return {
        ...state,
        answers: cleared,
        currentStep: getNextStep(state.currentStep),
      }
    }

    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload }

    case 'SET_TEST_RESULTS':
      return { ...state, testParseResults: action.payload }

    case 'FLAG_EVENTS':
      return {
        ...state,
        flaggedEvents: action.payload,
        currentFlaggedIndex: 0,
        currentStep: 'correction',
      }

    case 'SET_CORRECTIONS': {
      const { eventId, corrections } = action.payload
      return {
        ...state,
        flaggedEvents: state.flaggedEvents.map((f) =>
          f.eventId === eventId ? { ...f, corrections } : f
        ),
      }
    }

    case 'RESOLVE_FLAG': {
      const eventId = action.payload
      return {
        ...state,
        flaggedEvents: state.flaggedEvents.map((f) =>
          f.eventId === eventId
            ? {
                ...f,
                resolved: true,
                correctionRound: f.correctionRound + 1,
              }
            : f
        ),
      }
    }

    case 'ADVANCE_FLAGGED': {
      // Find the next unresolved flagged event (skip resolved ones)
      const nextUnresolved = state.flaggedEvents.findIndex(
        (f, i) => i > state.currentFlaggedIndex && !f.resolved
      )
      if (nextUnresolved === -1) {
        // All flagged events handled — return to review
        return { ...state, currentStep: 'reviewTest', currentFlaggedIndex: 0 }
      }
      return { ...state, currentFlaggedIndex: nextUnresolved }
    }

    case 'SET_ELAPSED':
      return { ...state, elapsedSeconds: action.payload }

    case 'SET_SUGGESTED_NAME':
      return { ...state, suggestedTemplateName: action.payload }

    case 'TOGGLE_CANCEL_DIALOG':
      return { ...state, cancelDialogOpen: !state.cancelDialogOpen }

    case 'RETRY':
      return {
        ...state,
        currentStep: 'loading',
        loading: true,
        error: null,
        elapsedSeconds: 0,
        loadingTip: LOADING_TIPS[0],
      }

    case 'START_OVER':
      return createInitialState()

    default:
      return state
  }
}

/**
 * Clear the answer for a specific step when it's skipped.
 */
function clearStepAnswer(
  answers: WizardAnswers,
  step: WizardStepId
): WizardAnswers {
  switch (step) {
    case 'documentStructure':
      return { ...answers, documentStructure: null }
    case 'dateFormat':
      return { ...answers, dateFormat: null }
    case 'timezone':
      return { ...answers, timezone: null }
    case 'locations':
      return { ...answers, locations: [] }
    case 'statusCodes':
      return { ...answers, statusCodes: [] }
    case 'eventNames':
      return { ...answers, eventNamePosition: null }
    default:
      return answers
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook that provides wizard state and dispatch.
 * Initializes the reducer with the default wizard state.
 */
export function useWizardReducer() {
  return useReducer(wizardReducer, undefined, createInitialState)
}
