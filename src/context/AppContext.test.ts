import { describe, it, expect } from 'vitest'
import { appReducer } from './AppContext'
import type { AppState } from './AppContext'
import type { ParsedEvent } from '../services/parser'

/** Create a minimal event for reducer tests. */
function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'evt-1',
    name: 'Test Event',
    startDate: '2026-03-15',
    endDate: '2026-03-18',
    moveInDate: null,
    moveOutDate: null,
    location: 'Hall A',
    status: 'Confirmed',
    customFields: {},
    rawText: 'raw',
    warnings: [],
    isSelected: true,
    ...overrides,
  }
}

/** Create a base state with parsed events. */
function stateWith(events: ParsedEvent[]): AppState {
  return { pdfData: null, selectedTemplate: null, parsedEvents: events }
}

describe('appReducer', () => {
  describe('SET_PARSED_EVENTS', () => {
    it('sets parsed events array', () => {
      const events = [makeEvent()]
      const result = appReducer(stateWith([]), { type: 'SET_PARSED_EVENTS', payload: events })
      expect(result.parsedEvents).toEqual(events)
    })
  })

  describe('TOGGLE_EVENT', () => {
    it('toggles isSelected from true to false', () => {
      const result = appReducer(
        stateWith([makeEvent({ isSelected: true })]),
        { type: 'TOGGLE_EVENT', payload: 'evt-1' }
      )
      expect(result.parsedEvents[0].isSelected).toBe(false)
    })

    it('toggles isSelected from false to true', () => {
      const result = appReducer(
        stateWith([makeEvent({ isSelected: false })]),
        { type: 'TOGGLE_EVENT', payload: 'evt-1' }
      )
      expect(result.parsedEvents[0].isSelected).toBe(true)
    })

    it('does not affect other events', () => {
      const result = appReducer(
        stateWith([makeEvent({ id: 'evt-1', isSelected: true }), makeEvent({ id: 'evt-2', isSelected: false })]),
        { type: 'TOGGLE_EVENT', payload: 'evt-1' }
      )
      expect(result.parsedEvents[0].isSelected).toBe(false)
      expect(result.parsedEvents[1].isSelected).toBe(false)
    })
  })

  describe('SELECT_ALL_EVENTS', () => {
    it('sets all events to selected', () => {
      const result = appReducer(
        stateWith([makeEvent({ isSelected: false }), makeEvent({ id: 'evt-2', isSelected: false })]),
        { type: 'SELECT_ALL_EVENTS' }
      )
      expect(result.parsedEvents.every((e) => e.isSelected)).toBe(true)
    })
  })

  describe('SELECT_NONE_EVENTS', () => {
    it('sets all events to unselected', () => {
      const result = appReducer(
        stateWith([makeEvent({ isSelected: true }), makeEvent({ id: 'evt-2', isSelected: true })]),
        { type: 'SELECT_NONE_EVENTS' }
      )
      expect(result.parsedEvents.every((e) => !e.isSelected)).toBe(true)
    })
  })

  describe('ACCEPT_SUGGESTION', () => {
    it('applies suggestion to the specified field and removes warning', () => {
      const event = makeEvent({
        startDate: '2026-01-01',
        warnings: [
          { field: 'startDate', message: 'Ambiguous', rawValue: '1/1', suggestion: '2026-01-01' },
        ],
      })
      const result = appReducer(stateWith([event]), {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'evt-1', warningIndex: 0 },
      })
      expect(result.parsedEvents[0].startDate).toBe('2026-01-01')
      expect(result.parsedEvents[0].warnings).toHaveLength(0)
    })

    it('does nothing for non-existent event', () => {
      const event = makeEvent({
        warnings: [
          { field: 'startDate', message: 'test', rawValue: 'x', suggestion: '2026-01-01' },
        ],
      })
      const state = stateWith([event])
      const result = appReducer(state, {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'nonexistent', warningIndex: 0 },
      })
      expect(result.parsedEvents[0].warnings).toHaveLength(1)
    })

    it('does nothing if warning has no suggestion', () => {
      const event = makeEvent({
        warnings: [
          { field: 'startDate', message: 'Missing', rawValue: '', suggestion: null },
        ],
      })
      const result = appReducer(stateWith([event]), {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'evt-1', warningIndex: 0 },
      })
      expect(result.parsedEvents[0].warnings).toHaveLength(1)
    })

    it('does nothing for out-of-bounds warningIndex', () => {
      const event = makeEvent({
        warnings: [
          { field: 'startDate', message: 'test', rawValue: 'x', suggestion: '2026-01-01' },
        ],
      })
      const result = appReducer(stateWith([event]), {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'evt-1', warningIndex: 5 },
      })
      expect(result.parsedEvents[0].warnings).toHaveLength(1)
    })

    it('rejects field names not in the allowlist', () => {
      const event = makeEvent({
        warnings: [
          { field: 'id', message: 'Overwrite attempt', rawValue: 'x', suggestion: 'evil-id' },
        ],
      })
      const result = appReducer(stateWith([event]), {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'evt-1', warningIndex: 0 },
      })
      expect(result.parsedEvents[0].id).toBe('evt-1')
      expect(result.parsedEvents[0].warnings).toHaveLength(1)
    })

    it('rejects structural field overwrite attempts (isSelected)', () => {
      const event = makeEvent({
        isSelected: true,
        warnings: [
          { field: 'isSelected', message: 'test', rawValue: 'x', suggestion: 'false' },
        ],
      })
      const result = appReducer(stateWith([event]), {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'evt-1', warningIndex: 0 },
      })
      expect(result.parsedEvents[0].isSelected).toBe(true)
      expect(result.parsedEvents[0].warnings).toHaveLength(1)
    })

    it('removes only the accepted warning, keeping others', () => {
      const event = makeEvent({
        warnings: [
          { field: 'startDate', message: 'w1', rawValue: 'x', suggestion: '2026-01-01' },
          { field: 'endDate', message: 'w2', rawValue: 'y', suggestion: '2026-02-01' },
        ],
      })
      const result = appReducer(stateWith([event]), {
        type: 'ACCEPT_SUGGESTION',
        payload: { eventId: 'evt-1', warningIndex: 0 },
      })
      expect(result.parsedEvents[0].warnings).toHaveLength(1)
      expect(result.parsedEvents[0].warnings[0].field).toBe('endDate')
    })
  })
})
