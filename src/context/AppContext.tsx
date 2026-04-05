import { createContext, useContext, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { ExtractionWarning } from '../services/pdfExtractor'
import type { ProfileTemplate } from '../schemas/templateSchema'

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
}

/** Actions that modify app state. */
type AppAction =
  | { type: 'SET_PDF_DATA'; payload: PdfData }
  | { type: 'CLEAR_PDF_DATA' }
  | { type: 'SET_TEMPLATE'; payload: ProfileTemplate }
  | { type: 'CLEAR_TEMPLATE' }

const initialState: AppState = {
  pdfData: null,
  selectedTemplate: null,
}

/**
 * Reducer for app-wide state management.
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PDF_DATA':
      return { ...state, pdfData: action.payload }
    case 'CLEAR_PDF_DATA':
      return { ...state, pdfData: null }
    case 'SET_TEMPLATE':
      return { ...state, selectedTemplate: action.payload }
    case 'CLEAR_TEMPLATE':
      return { ...state, selectedTemplate: null }
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
