import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ExportPage } from './ExportPage'
import type { ParsedEvent } from '../services/parser'
import type { ProfileTemplate } from '../schemas/templateSchema'

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'evt-1',
    name: 'ACME Trade Show',
    startDate: '2026-03-15',
    endDate: '2026-03-18',
    moveInDate: '2026-03-13',
    moveOutDate: '2026-03-20',
    location: 'Hall A',
    status: 'Confirmed',
    customFields: {},
    rawText: 'raw text',
    warnings: [],
    isSelected: true,
    ...overrides,
  }
}

const mockTemplate: ProfileTemplate = {
  name: 'Test Calendar',
  version: '1.0',
  structure: { type: 'block', blockDelimiter: '^\\d+' },
  dateFormats: [{ pattern: '(?<m>\\d+)', fields: ['startDate'] }],
  fields: {},
}

const mockNavigate = vi.fn()

let mockState: {
  pdfData: null
  selectedTemplate: ProfileTemplate | null
  parsedEvents: ParsedEvent[]
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    state: mockState,
    dispatch: vi.fn(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ExportPage />
    </MemoryRouter>,
  )
}

describe('ExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = {
      pdfData: null,
      selectedTemplate: mockTemplate,
      parsedEvents: [makeEvent(), makeEvent({ id: 'evt-2', name: 'Widget Expo' })],
    }
  })

  it('shows "no events" message when none selected', () => {
    mockState.parsedEvents = [makeEvent({ isSelected: false })]
    renderPage()
    expect(screen.getByText('No events selected for export.')).toBeInTheDocument()
  })

  it('shows back to results button on empty state', async () => {
    mockState.parsedEvents = [makeEvent({ isSelected: false })]
    renderPage()
    const btn = screen.getByText('Back to Results')
    await userEvent.click(btn)
    expect(mockNavigate).toHaveBeenCalledWith('/results')
  })

  it('displays event count in heading', () => {
    renderPage()
    expect(screen.getByText('Export 2 events')).toBeInTheDocument()
  })

  it('renders four format cards', () => {
    renderPage()
    expect(screen.getByText('ICS')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('MD')).toBeInTheDocument()
  })

  it('selects ICS format by default', () => {
    renderPage()
    const icsButton = screen.getByText('ICS').closest('button')!
    expect(icsButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows ICS options by default', () => {
    renderPage()
    expect(screen.getByText('ICS Options')).toBeInTheDocument()
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument()
  })

  it('switches to CSV options when CSV card clicked', async () => {
    renderPage()
    await userEvent.click(screen.getByText('CSV'))
    expect(screen.getByText('CSV Options')).toBeInTheDocument()
    expect(screen.getByLabelText('Delimiter')).toBeInTheDocument()
  })

  it('switches to JSON options when JSON card clicked', async () => {
    renderPage()
    await userEvent.click(screen.getByText('JSON'))
    expect(screen.getByText('JSON Options')).toBeInTheDocument()
    expect(screen.getByText('Pretty print (2-space indent)')).toBeInTheDocument()
  })

  it('switches to MD options when MD card clicked', async () => {
    renderPage()
    await userEvent.click(screen.getByText('MD'))
    expect(screen.getByText('MD Options')).toBeInTheDocument()
  })

  it('shows preview panel', () => {
    renderPage()
    expect(screen.getByText('Preview')).toBeInTheDocument()
    // ICS preview should contain VCALENDAR
    expect(screen.getByText(/BEGIN:VCALENDAR/)).toBeInTheDocument()
  })

  it('shows download button with format name', () => {
    renderPage()
    expect(screen.getByText('Download ICS File')).toBeInTheDocument()
  })

  it('updates download button text when format changes', async () => {
    renderPage()
    await userEvent.click(screen.getByText('CSV'))
    expect(screen.getByText('Download CSV File')).toBeInTheDocument()
  })

  it('shows template name at bottom', () => {
    renderPage()
    expect(screen.getByText(/Template: Test Calendar/)).toBeInTheDocument()
  })

  it('hides template section when no template', () => {
    mockState.selectedTemplate = null
    renderPage()
    expect(screen.queryByText(/Template:/)).not.toBeInTheDocument()
  })

  it('shows back button that navigates to results', async () => {
    renderPage()
    const backBtn = screen.getByText('← Back')
    await userEvent.click(backBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/results')
  })

  it('ICS phase toggle buttons are present', () => {
    renderPage()
    // Phase toggle buttons have ✓ suffix when active
    expect(screen.getByRole('button', { name: /Move-In ✓/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Event ✓/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Move-Out ✓/ })).toBeInTheDocument()
  })

  it('CSV column toggle buttons work', async () => {
    renderPage()
    await userEvent.click(screen.getByText('CSV'))
    // Location should be enabled by default
    const locationBtn = screen.getByRole('button', { name: /Location ✓/ })
    expect(locationBtn).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(locationBtn)
    expect(locationBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('MD layout toggle switches between table and list', async () => {
    renderPage()
    await userEvent.click(screen.getByText('MD'))
    const listBtn = screen.getByRole('button', { name: 'list' })
    await userEvent.click(listBtn)
    expect(listBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('singular event text when only 1 event', () => {
    mockState.parsedEvents = [makeEvent()]
    renderPage()
    expect(screen.getByText('Export 1 event')).toBeInTheDocument()
  })
})
