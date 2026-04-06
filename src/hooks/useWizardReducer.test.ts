import { describe, expect, it } from 'vitest'
import {
  wizardReducer,
  createInitialState,
  QUIZ_STEPS,
  MAX_CORRECTION_ROUNDS,
  type WizardState,
  type WizardAction,
  type AiAnalysis,
} from './useWizardReducer'

/** Helper to create a minimal AI analysis for tests. */
function mockAnalysis(): AiAnalysis {
  return {
    documentStructure: {
      options: [
        { label: 'Block', value: 'block', source: 'sample' },
        { label: 'Table', value: 'table', source: 'sample' },
      ],
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
      candidates: [
        { name: 'Confirmed', confidence: 'high', source: 'Confirmed' },
      ],
    },
    eventNames: {
      candidates: [{ name: 'Tech Conference', source: 'Tech Conference\n...' }],
    },
    estimatedEventCount: 10,
    detectedTimezone: 'America/New_York',
    notes: null,
  }
}

/** Apply a sequence of actions to an initial state. */
function applyActions(actions: WizardAction[], initial?: WizardState): WizardState {
  return actions.reduce(
    (s, a) => wizardReducer(s, a),
    initial ?? createInitialState()
  )
}

describe('wizardReducer', () => {
  describe('initial state', () => {
    it('starts on loading step', () => {
      const state = createInitialState()
      expect(state.currentStep).toBe('loading')
      expect(state.loading).toBe(true)
      expect(state.aiAnalysis).toBeNull()
      expect(state.answers.documentStructure).toBeNull()
    })
  })

  describe('analysis lifecycle', () => {
    it('transitions to documentStructure on ANALYSIS_SUCCESS', () => {
      const state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
      ])
      expect(state.currentStep).toBe('documentStructure')
      expect(state.loading).toBe(false)
      expect(state.aiAnalysis).not.toBeNull()
    })

    it('transitions to failure on ANALYSIS_FAILURE', () => {
      const state = applyActions([
        {
          type: 'ANALYSIS_FAILURE',
          payload: { type: 'api_down', message: 'down' },
        },
      ])
      expect(state.currentStep).toBe('failure')
      expect(state.loading).toBe(false)
      expect(state.error?.type).toBe('api_down')
    })

    it('RETRY resets to loading', () => {
      const state = applyActions([
        {
          type: 'ANALYSIS_FAILURE',
          payload: { type: 'generic', message: 'err' },
        },
        { type: 'RETRY' },
      ])
      expect(state.currentStep).toBe('loading')
      expect(state.loading).toBe(true)
      expect(state.error).toBeNull()
    })
  })

  describe('step navigation', () => {
    it('NEXT_STEP advances through quiz steps in order', () => {
      let state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
      ])
      expect(state.currentStep).toBe('documentStructure')

      for (let i = 1; i < QUIZ_STEPS.length; i++) {
        state = wizardReducer(state, { type: 'NEXT_STEP' })
        expect(state.currentStep).toBe(QUIZ_STEPS[i])
      }

      // After last quiz step → reviewTest
      state = wizardReducer(state, { type: 'NEXT_STEP' })
      expect(state.currentStep).toBe('reviewTest')
    })

    it('PREV_STEP goes back through quiz steps', () => {
      let state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
        { type: 'NEXT_STEP' }, // → dateFormat
        { type: 'NEXT_STEP' }, // → timezone
      ])
      expect(state.currentStep).toBe('timezone')

      state = wizardReducer(state, { type: 'PREV_STEP' })
      expect(state.currentStep).toBe('dateFormat')

      state = wizardReducer(state, { type: 'PREV_STEP' })
      expect(state.currentStep).toBe('documentStructure')
    })

    it('PREV_STEP does not go before first quiz step', () => {
      const state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
        { type: 'PREV_STEP' },
      ])
      expect(state.currentStep).toBe('documentStructure')
    })

    it('GO_TO_STEP jumps to an arbitrary step', () => {
      const state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
        { type: 'GO_TO_STEP', payload: 'saveTemplate' },
      ])
      expect(state.currentStep).toBe('saveTemplate')
    })

    it('after reviewTest, NEXT_STEP goes to saveTemplate', () => {
      const state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
        { type: 'GO_TO_STEP', payload: 'reviewTest' },
        { type: 'NEXT_STEP' },
      ])
      expect(state.currentStep).toBe('saveTemplate')
    })
  })

  describe('answer setters', () => {
    it('SET_STRUCTURE updates documentStructure answer', () => {
      const state = applyActions([
        { type: 'SET_STRUCTURE', payload: 'table' },
      ])
      expect(state.answers.documentStructure).toBe('table')
    })

    it('SET_DATE_FORMAT updates dateFormat answer', () => {
      const state = applyActions([
        { type: 'SET_DATE_FORMAT', payload: { pattern: '\\d+', format: 'MM/DD' } },
      ])
      expect(state.answers.dateFormat).toEqual({ pattern: '\\d+', format: 'MM/DD' })
    })

    it('SET_TIMEZONE updates timezone answer', () => {
      const state = applyActions([
        { type: 'SET_TIMEZONE', payload: 'America/Chicago' },
      ])
      expect(state.answers.timezone).toBe('America/Chicago')
    })

    it('SET_LOCATIONS updates locations answer', () => {
      const state = applyActions([
        { type: 'SET_LOCATIONS', payload: ['Hall A', 'Hall B'] },
      ])
      expect(state.answers.locations).toEqual(['Hall A', 'Hall B'])
    })

    it('SET_STATUS_CODES updates statusCodes answer', () => {
      const state = applyActions([
        { type: 'SET_STATUS_CODES', payload: ['Confirmed', 'Tentative'] },
      ])
      expect(state.answers.statusCodes).toEqual(['Confirmed', 'Tentative'])
    })

    it('SET_EVENT_NAME_POSITION updates eventNamePosition answer', () => {
      const state = applyActions([
        { type: 'SET_EVENT_NAME_POSITION', payload: 'first_line' },
      ])
      expect(state.answers.eventNamePosition).toBe('first_line')
    })
  })

  describe('skip', () => {
    it('SKIP_STEP clears the answer and advances', () => {
      const state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
        { type: 'SET_STRUCTURE', payload: 'block' },
        { type: 'SKIP_STEP' },
      ])
      expect(state.answers.documentStructure).toBeNull()
      expect(state.currentStep).toBe('dateFormat')
    })

    it('SKIP_STEP clears locations array', () => {
      let state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
      ])
      // Advance to locations step
      state = wizardReducer(state, { type: 'NEXT_STEP' }) // dateFormat
      state = wizardReducer(state, { type: 'NEXT_STEP' }) // timezone
      state = wizardReducer(state, { type: 'NEXT_STEP' }) // locations
      state = wizardReducer(state, {
        type: 'SET_LOCATIONS',
        payload: ['Hall A'],
      })
      state = wizardReducer(state, { type: 'SKIP_STEP' })
      expect(state.answers.locations).toEqual([])
      expect(state.currentStep).toBe('statusCodes')
    })
  })

  describe('correction flow', () => {
    it('FLAG_EVENTS sets flagged events and goes to correction step', () => {
      const flagged = [
        {
          eventId: 'e1',
          issues: ['dates'],
          correctionRound: 0,
          resolved: false,
          corrections: [],
        },
      ]
      const state = applyActions([{ type: 'FLAG_EVENTS', payload: flagged }])
      expect(state.currentStep).toBe('correction')
      expect(state.flaggedEvents).toHaveLength(1)
      expect(state.currentFlaggedIndex).toBe(0)
    })

    it('RESOLVE_FLAG marks event resolved and increments round', () => {
      const state = applyActions([
        {
          type: 'FLAG_EVENTS',
          payload: [
            {
              eventId: 'e1',
              issues: ['dates'],
              correctionRound: 0,
              resolved: false,
              corrections: [],
            },
          ],
        },
        { type: 'RESOLVE_FLAG', payload: 'e1' },
      ])
      expect(state.flaggedEvents[0].resolved).toBe(true)
      expect(state.flaggedEvents[0].correctionRound).toBe(1)
    })

    it('ADVANCE_FLAGGED returns to reviewTest when all resolved', () => {
      const state = applyActions([
        {
          type: 'FLAG_EVENTS',
          payload: [
            {
              eventId: 'e1',
              issues: ['dates'],
              correctionRound: 0,
              resolved: false,
              corrections: [],
            },
          ],
        },
        { type: 'RESOLVE_FLAG', payload: 'e1' },
        { type: 'ADVANCE_FLAGGED' },
      ])
      expect(state.currentStep).toBe('reviewTest')
    })

    it('ADVANCE_FLAGGED moves to next unresolved event', () => {
      const state = applyActions([
        {
          type: 'FLAG_EVENTS',
          payload: [
            {
              eventId: 'e1',
              issues: ['dates'],
              correctionRound: 0,
              resolved: false,
              corrections: [],
            },
            {
              eventId: 'e2',
              issues: ['location'],
              correctionRound: 0,
              resolved: false,
              corrections: [],
            },
          ],
        },
        { type: 'RESOLVE_FLAG', payload: 'e1' },
        { type: 'ADVANCE_FLAGGED' },
      ])
      expect(state.currentStep).toBe('correction')
      expect(state.currentFlaggedIndex).toBe(1)
    })

    it('ADVANCE_FLAGGED skips resolved events to find next unresolved', () => {
      const state = applyActions([
        {
          type: 'FLAG_EVENTS',
          payload: [
            { eventId: 'e1', issues: ['dates'], correctionRound: 0, resolved: false, corrections: [] },
            { eventId: 'e2', issues: ['dates'], correctionRound: 0, resolved: false, corrections: [] },
            { eventId: 'e3', issues: ['location'], correctionRound: 0, resolved: false, corrections: [] },
          ],
        },
        { type: 'RESOLVE_FLAG', payload: 'e1' },
        { type: 'RESOLVE_FLAG', payload: 'e2' },
        { type: 'ADVANCE_FLAGGED' },
      ])
      expect(state.currentStep).toBe('correction')
      expect(state.currentFlaggedIndex).toBe(2)
    })
  })

  describe('save template', () => {
    it('SET_TEMPLATE_NAME updates the name', () => {
      const state = applyActions([
        { type: 'SET_TEMPLATE_NAME', payload: 'My Template' },
      ])
      expect(state.templateName).toBe('My Template')
    })

    it('SET_SAVE_OPTIONS merges options', () => {
      const state = applyActions([
        { type: 'SET_SAVE_OPTIONS', payload: { download: true } },
      ])
      expect(state.saveOptions).toEqual({
        browser: true,
        download: true,
        share: false,
      })
    })
  })

  describe('cancel dialog', () => {
    it('TOGGLE_CANCEL_DIALOG flips the flag', () => {
      const s1 = applyActions([{ type: 'TOGGLE_CANCEL_DIALOG' }])
      expect(s1.cancelDialogOpen).toBe(true)

      const s2 = wizardReducer(s1, { type: 'TOGGLE_CANCEL_DIALOG' })
      expect(s2.cancelDialogOpen).toBe(false)
    })
  })

  describe('START_OVER', () => {
    it('resets to initial state', () => {
      const state = applyActions([
        { type: 'ANALYSIS_SUCCESS', payload: mockAnalysis() },
        { type: 'SET_STRUCTURE', payload: 'table' },
        { type: 'NEXT_STEP' },
        { type: 'START_OVER' },
      ])
      const initial = createInitialState()
      expect(state.currentStep).toBe(initial.currentStep)
      expect(state.answers).toEqual(initial.answers)
      expect(state.aiAnalysis).toBeNull()
    })
  })

  describe('elapsed time tracking', () => {
    it('SET_ELAPSED updates elapsedSeconds', () => {
      const state = applyActions([{ type: 'SET_ELAPSED', payload: 30 }])
      expect(state.elapsedSeconds).toBe(30)
    })

    it('ANALYSIS_START resets elapsedSeconds to 0', () => {
      const state = applyActions([
        { type: 'SET_ELAPSED', payload: 45 },
        { type: 'ANALYSIS_START' },
      ])
      expect(state.elapsedSeconds).toBe(0)
    })

    it('RETRY resets elapsedSeconds to 0', () => {
      const state = applyActions([
        { type: 'SET_ELAPSED', payload: 60 },
        { type: 'RETRY' },
      ])
      expect(state.elapsedSeconds).toBe(0)
    })
  })

  describe('suggested template name', () => {
    it('SET_SUGGESTED_NAME stores the suggestion', () => {
      const state = applyActions([
        { type: 'SET_SUGGESTED_NAME', payload: 'Convention Calendar' },
      ])
      expect(state.suggestedTemplateName).toBe('Convention Calendar')
    })

    it('initial state has null suggestedTemplateName', () => {
      const state = createInitialState()
      expect(state.suggestedTemplateName).toBeNull()
    })

    it('START_OVER clears suggestedTemplateName', () => {
      const state = applyActions([
        { type: 'SET_SUGGESTED_NAME', payload: 'Test' },
        { type: 'START_OVER' },
      ])
      expect(state.suggestedTemplateName).toBeNull()
    })
  })

  describe('new error types', () => {
    it('accepts unrecognized_format error', () => {
      const state = applyActions([
        {
          type: 'ANALYSIS_FAILURE',
          payload: { type: 'unrecognized_format', message: 'Not calendar data' },
        },
      ])
      expect(state.error?.type).toBe('unrecognized_format')
    })

    it('accepts timeout error', () => {
      const state = applyActions([
        {
          type: 'ANALYSIS_FAILURE',
          payload: { type: 'timeout', message: 'Request timed out' },
        },
      ])
      expect(state.error?.type).toBe('timeout')
    })
  })

  describe('constants', () => {
    it('QUIZ_STEPS has 6 entries', () => {
      expect(QUIZ_STEPS).toHaveLength(6)
    })

    it('MAX_CORRECTION_ROUNDS is 3', () => {
      expect(MAX_CORRECTION_ROUNDS).toBe(3)
    })
  })
})
