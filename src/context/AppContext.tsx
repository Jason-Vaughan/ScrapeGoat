import { createContext, useContext, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { ExtractionWarning } from '../services/pdfExtractor'
import type { ProfileTemplate } from '../schemas/templateSchema'
import type { ParsedEvent } from '../services/parser'

/** Shape of the extracted PDF data stored in app state. */
export interface PdfData {
  text: string
  pageCount: number
  warnings: ExtractionWarning[]
  fileName: string
}

/** App-wide state. */
export interface AppState {
  pdfData: PdfData | null
  selectedTemplate: ProfileTemplate | null
  parsedEvents: ParsedEvent[]
}

/** Actions that modify app state. */
export type AppAction =
  | { type: 'SET_PDF_DATA'; payload: PdfData }
  | { type: 'CLEAR_PDF_DATA' }
  | { type: 'SET_TEMPLATE'; payload: ProfileTemplate }
  | { type: 'CLEAR_TEMPLATE' }
  | { type: 'SET_PARSED_EVENTS'; payload: ParsedEvent[] }
  | { type: 'TOGGLE_EVENT'; payload: string }
  | { type: 'SELECT_ALL_EVENTS' }
  | { type: 'SELECT_NONE_EVENTS' }
  | { type: 'ACCEPT_SUGGESTION'; payload: { eventId: string; warningIndex: number } }

const initialState: AppState = {
  pdfData: null,
  selectedTemplate: null,
  parsedEvents: [],
}

/**
 * Reducer for app-wide state management.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PDF_DATA':
      return { ...state, pdfData: action.payload }
    case 'CLEAR_PDF_DATA':
      return { ...state, pdfData: null }
    case 'SET_TEMPLATE':
      return { ...state, selectedTemplate: action.payload }
    case 'CLEAR_TEMPLATE':
      return { ...state, selectedTemplate: null }
    case 'SET_PARSED_EVENTS':
      return { ...state, parsedEvents: action.payload }
    case 'TOGGLE_EVENT':
      return {
        ...state,
        parsedEvents: state.parsedEvents.map((e) =>
          e.id === action.payload ? { ...e, isSelected: !e.isSelected } : e
        ),
      }
    case 'SELECT_ALL_EVENTS':
      return {
        ...state,
        parsedEvents: state.parsedEvents.map((e) => ({ ...e, isSelected: true })),
      }
    case 'SELECT_NONE_EVENTS':
      return {
        ...state,
        parsedEvents: state.parsedEvents.map((e) => ({ ...e, isSelected: false })),
      }
    case 'ACCEPT_SUGGESTION': {
      const { eventId, warningIndex } = action.payload
      const ALLOWED_FIELDS = new Set([
        'name', 'startDate', 'endDate', 'moveInDate', 'moveOutDate',
        'location', 'status',
      ])
      return {
        ...state,
        parsedEvents: state.parsedEvents.map((e) => {
          if (e.id !== eventId) return e
          const warning = e.warnings[warningIndex]
          if (!warning?.suggestion) return e
          if (!ALLOWED_FIELDS.has(warning.field)) return e
          const updatedWarnings = e.warnings.filter((_, i) => i !== warningIndex)
          return { ...e, [warning.field]: warning.suggestion, warnings: updatedWarnings }
        }),
      }
    }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextValue | null>(null)

/**
 * Provider component that wraps the app with shared state.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

/**
 * Hook to access app state and dispatch from any component.
 * Must be used within AppProvider.
 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return ctx
}
