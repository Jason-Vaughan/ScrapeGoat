import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WizardPage } from './WizardPage'
import { AppProvider, useAppContext } from '../context/AppContext'
import { useEffect } from 'react'
import type { PdfData } from '../context/AppContext'

// Mock the real AI service
vi.mock('../services/aiService', () => ({
  analyzeDocument: vi.fn().mockResolvedValue({
    documentStructure: {
      options: [
        { label: 'Block', value: 'block', source: 'Event A\nMarch 15...' },
      ],
    },
    dateFormats: {
      detected: [
        {
          label: 'MM/DD/YYYY',
          pattern: '\\d+/\\d+/\\d+',
          format: 'MM/DD/YYYY',
          examples: ['03/15/2026'],
          source: '03/15/2026',
        },
      ],
    },
    locations: {
      candidates: [
        { name: 'Hall A', confidence: 'high', source: 'Hall A' },
      ],
    },
    statusCodes: {
      candidates: [
        { name: 'Confirmed', confidence: 'high', source: 'Confirmed' },
      ],
    },
    eventNames: {
      candidates: [
        { name: 'Tech Conference', source: 'Tech Conference...' },
      ],
    },
    estimatedEventCount: 10,
    detectedTimezone: 'America/New_York',
    notes: null,
    suggestedTemplateName: 'Tech Conference Calendar',
  }),
  getCorrectionSuggestions: vi.fn().mockResolvedValue([]),
  AiServiceError: class AiServiceError extends Error {
    errorType: string
    constructor(message: string, errorType: string) {
      super(message)
      this.errorType = errorType
    }
  },
}))

// Mock Turnstile hook — always provide a token so analysis proceeds
vi.mock('../hooks/useTurnstile', () => ({
  useTurnstile: () => ({
    token: 'mock-turnstile-token',
    reset: vi.fn(),
    containerRef: { current: null },
    ready: true,
    configured: false, // No Turnstile widget in tests
  }),
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const testPdfData: PdfData = {
  text: 'Annual Tech Conference\nMarch 15-17, 2026\nHall A\nStatus: Confirmed',
  pageCount: 1,
  warnings: [],
  fileName: 'test.pdf',
}

/**
 * Helper component that injects pdfData into context before rendering WizardPage.
 */
function SetPdfAndRender({ pdfData }: { pdfData: PdfData }) {
  const { dispatch } = useAppContext()

  useEffect(() => {
    dispatch({ type: 'SET_PDF_DATA', payload: pdfData })
  }, [dispatch, pdfData])

  return <WizardPage />
}

/** Render WizardPage with PDF data pre-set in context. */
function renderWithPdfData(pdfData: PdfData) {
  return render(
    <MemoryRouter initialEntries={['/wizard']}>
      <AppProvider>
        <SetPdfAndRender pdfData={pdfData} />
      </AppProvider>
    </MemoryRouter>
  )
}

describe('WizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to home when no PDF data', () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <WizardPage />
        </AppProvider>
      </MemoryRouter>
    )
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows loading screen initially when PDF data is present', async () => {
    renderWithPdfData(testPdfData)

    await waitFor(() => {
      expect(
        screen.getByText('Analyzing your document')
      ).toBeInTheDocument()
    })
  })

  it('shows first quiz step after analysis completes', async () => {
    renderWithPdfData(testPdfData)

    await waitFor(() => {
      expect(
        screen.getByText('How is this calendar organized?')
      ).toBeInTheDocument()
    })
  })

  it('shows progress bar on quiz steps', async () => {
    renderWithPdfData(testPdfData)

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
    })
  })

  it('shows cancel and skip buttons on quiz steps', async () => {
    renderWithPdfData(testPdfData)

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Skip')).toBeInTheDocument()
    })
  })
})
