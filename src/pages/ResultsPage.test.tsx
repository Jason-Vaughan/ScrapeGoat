import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ResultsPage } from './ResultsPage'
import type { ParsedEvent } from '../services/parser'
import type { ProfileTemplate } from '../schemas/templateSchema'

const mockTemplate: ProfileTemplate = {
  name: 'Test Calendar',
  version: '1.0',
  structure: { type: 'block', blockDelimiter: '^\\d+' },
  dateFormats: [{ pattern: '(?<m>\\d+)', fields: ['startDate'] }],
  fields: {},
}

const mockPdfData = {
  text: 'line 1\nline 2',
  pageCount: 1,
  warnings: [] as string[],
  fileName: 'test.pdf',
}

/** Create a mock event for testing. */
function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'evt-1',
    name: 'ACME Trade Show',
    startDate: '2026-03-15',
    endDate: '2026-03-18',
    moveInDate: '2026-03-13',
    moveOutDate: '2026-03-19',
    location: 'Hall A',
    status: 'Confirmed',
    customFields: {},
    rawText: 'ACME Trade Show\nMar 15-18\nHall A\nConfirmed',
    warnings: [],
    isSelected: true,
    ...overrides,
  }
}

const mockDispatch = vi.fn()
const mockNavigate = vi.fn()

let mockState: {
  pdfData: typeof mockPdfData | null
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
    dispatch: mockDispatch,
  }),
}))

vi.mock('../services/parser', () => ({
  parseText: vi.fn().mockResolvedValue([]),
}))

/**
 * Render ResultsPage with MemoryRouter, returning the desktop table container.
 */
function renderPage() {
  const result = render(
    <MemoryRouter initialEntries={['/results']}>
      <ResultsPage />
    </MemoryRouter>
  )
  return result
}

/**
 * Get the desktop table container for scoped queries.
 */
function getDesktopTable() {
  return screen.getByRole('table')
}

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = {
      pdfData: mockPdfData,
      selectedTemplate: mockTemplate,
      parsedEvents: [
        makeEvent(),
        makeEvent({
          id: 'evt-2',
          name: 'Widget Expo',
          startDate: '2026-03-22',
          endDate: '2026-03-25',
          status: 'Tentative',
          warnings: [
            {
              field: 'endDate',
              message: 'Ambiguous date',
              rawValue: '3/25',
              suggestion: '2026-03-25',
            },
          ],
        }),
        makeEvent({
          id: 'evt-3',
          name: 'Garden Show',
          startDate: '2026-04-10',
          endDate: '2026-04-14',
          status: 'Confirmed',
          isSelected: false,
        }),
      ],
    }
  })

  it('redirects to home if no PDF data', () => {
    mockState.pdfData = null
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('redirects to home if no template selected', () => {
    mockState.selectedTemplate = null
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('displays template name and event/warning counts', () => {
    renderPage()
    expect(screen.getByText(/Test Calendar/)).toBeInTheDocument()
    expect(screen.getByText(/3 events found/)).toBeInTheDocument()
    // Warning count appears in header and summary, use getAllByText
    const warningTexts = screen.getAllByText(/1 warning/)
    expect(warningTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('renders all events in the desktop table', () => {
    renderPage()
    const table = getDesktopTable()
    expect(within(table).getByText('ACME Trade Show')).toBeInTheDocument()
    expect(within(table).getByText('Widget Expo')).toBeInTheDocument()
    expect(within(table).getByText('Garden Show')).toBeInTheDocument()
  })

  it('shows selection count', () => {
    renderPage()
    expect(screen.getByText('2 of 3 events selected')).toBeInTheDocument()
  })

  it('dispatches TOGGLE_EVENT when checkbox clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = getDesktopTable()
    const checkboxes = within(table).getAllByRole('checkbox', { name: /Select/ })
    await user.click(checkboxes[0])
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_EVENT',
      payload: 'evt-1',
    })
  })

  it('dispatches SELECT_ALL_EVENTS on Select All click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Select All'))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SELECT_ALL_EVENTS' })
  })

  it('dispatches SELECT_NONE_EVENTS on Select None click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Select None'))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SELECT_NONE_EVENTS' })
  })

  it('toggles column visibility when pill is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    // Start column is visible by default
    expect(screen.getByRole('columnheader', { name: 'Start' })).toBeInTheDocument()
    // Click the Start pill to hide it
    const startPill = screen.getByRole('button', { name: 'Start' })
    await user.click(startPill)
    expect(screen.queryByRole('columnheader', { name: 'Start' })).not.toBeInTheDocument()
    // Click again to show it
    await user.click(startPill)
    expect(screen.getByRole('columnheader', { name: 'Start' })).toBeInTheDocument()
  })

  it('shows Move-In column when toggled on', async () => {
    const user = userEvent.setup()
    renderPage()
    // Move-In is off by default
    expect(screen.queryByRole('columnheader', { name: 'Move-In' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move-In' }))
    expect(screen.getByRole('columnheader', { name: 'Move-In' })).toBeInTheDocument()
  })

  it('shows warning icon on events with warnings', () => {
    renderPage()
    const table = getDesktopTable()
    const widgetButton = within(table).getByRole('button', { name: /Widget Expo/ })
    expect(widgetButton.querySelector('[aria-label="has warnings"]')).toBeTruthy()
  })

  it('expands event detail on name click and shows warnings', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = getDesktopTable()
    await user.click(within(table).getByRole('button', { name: /Widget Expo/ }))
    // Warning details should appear within the table's expanded row
    expect(within(table).getByText('Warnings')).toBeInTheDocument()
    expect(within(table).getByText('Ambiguous date')).toBeInTheDocument()
    expect(within(table).getByText('Raw PDF Text')).toBeInTheDocument()
  })

  it('shows warning details with field, issue, raw value, and suggestion', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = getDesktopTable()
    await user.click(within(table).getByRole('button', { name: /Widget Expo/ }))
    expect(within(table).getByText('endDate')).toBeInTheDocument()
    expect(within(table).getByText('Ambiguous date')).toBeInTheDocument()
    // Raw value "3/25" appears in both the date column and warning code element
    const rawValues = within(table).getAllByText('3/25')
    expect(rawValues.length).toBe(2) // date cell + warning raw value
    expect(within(table).getByText('2026-03-25')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('dispatches ACCEPT_SUGGESTION when Accept clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = getDesktopTable()
    await user.click(within(table).getByRole('button', { name: /Widget Expo/ }))
    await user.click(within(table).getByRole('button', { name: 'Accept' }))
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ACCEPT_SUGGESTION',
      payload: { eventId: 'evt-2', warningIndex: 0 },
    })
  })

  it('shows raw text in expanded detail', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = getDesktopTable()
    await user.click(within(table).getByRole('button', { name: /ACME Trade Show/ }))
    // Raw text is shown in a <pre> element
    const pre = table.querySelector('pre')
    expect(pre).toBeTruthy()
    expect(pre!.textContent).toContain('ACME Trade Show')
    expect(pre!.textContent).toContain('Mar 15-18')
  })

  it('collapses event detail on second click', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = getDesktopTable()
    const btn = within(table).getByRole('button', { name: /ACME Trade Show/ })
    await user.click(btn)
    expect(within(table).getByText('Raw PDF Text')).toBeInTheDocument()
    await user.click(btn)
    expect(within(table).queryByText('Raw PDF Text')).not.toBeInTheDocument()
  })

  it('navigates to export when Export Selected Events clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Export Selected Events'))
    expect(mockNavigate).toHaveBeenCalledWith('/export')
  })

  it('disables export button when no events selected', () => {
    mockState.parsedEvents = mockState.parsedEvents.map((e) => ({
      ...e,
      isSelected: false,
    }))
    renderPage()
    expect(screen.getByText('Export Selected Events')).toBeDisabled()
  })

  it('clears state and navigates home on New PDF click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('New PDF'))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_PDF_DATA' })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_TEMPLATE' })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_PARSED_EVENTS',
      payload: [],
    })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('displays formatted dates in M/D format', () => {
    renderPage()
    const table = getDesktopTable()
    // Each date appears in both desktop and mobile; scope to table
    expect(within(table).getAllByText('3/15').length).toBeGreaterThanOrEqual(1)
    expect(within(table).getAllByText('3/18').length).toBeGreaterThanOrEqual(1)
  })

  it('shows warning count summary at bottom', () => {
    renderPage()
    const summaryText = screen.getByText(/click event name for details/)
    expect(summaryText).toBeInTheDocument()
  })

  it('column pills show aria-pressed state', () => {
    renderPage()
    const startPill = screen.getByRole('button', { name: 'Start' })
    const moveInPill = screen.getByRole('button', { name: 'Move-In' })
    expect(startPill).toHaveAttribute('aria-pressed', 'true')
    expect(moveInPill).toHaveAttribute('aria-pressed', 'false')
  })

  describe('date range filter', () => {
    it('shows all events by default', () => {
      renderPage()
      const table = getDesktopTable()
      expect(within(table).getByText('ACME Trade Show')).toBeInTheDocument()
      expect(within(table).getByText('Widget Expo')).toBeInTheDocument()
      expect(within(table).getByText('Garden Show')).toBeInTheDocument()
    })

    it('filters events by date range', async () => {
      const today = new Date()
      const near = new Date(today)
      near.setDate(near.getDate() + 10)
      const far = new Date(today)
      far.setDate(far.getDate() + 100)
      const nearIso = near.toISOString().slice(0, 10)
      const farIso = far.toISOString().slice(0, 10)

      mockState.parsedEvents = [
        makeEvent({ id: 'near', name: 'Near Event', startDate: nearIso }),
        makeEvent({ id: 'far', name: 'Far Event', startDate: farIso }),
      ]

      const user = userEvent.setup()
      renderPage()
      const select = screen.getByRole('combobox', { name: 'Date range filter' })
      await user.selectOptions(select, '30')
      const table = getDesktopTable()
      expect(within(table).getByText('Near Event')).toBeInTheDocument()
      expect(within(table).queryByText('Far Event')).not.toBeInTheDocument()
    })
  })

  describe('parsing state', () => {
    it('shows loading spinner when parsing', () => {
      mockState.parsedEvents = []
      renderPage()
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('Parsing events...')).toBeInTheDocument()
    })
  })
})
