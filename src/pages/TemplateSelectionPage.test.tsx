import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TemplateSelectionPage } from './TemplateSelectionPage'
import * as templateStorage from '../services/templateStorage'
import * as communityTemplates from '../services/communityTemplates'
import type { ProfileTemplate } from '../schemas/templateSchema'

const mockTemplate: ProfileTemplate = {
  name: 'Test Calendar',
  version: '1.0',
  structure: { type: 'block', blockDelimiter: '^\\d+' },
  dateFormats: [{ pattern: '(?<m>\\d+)', fields: ['startDate'] }],
  fields: {},
}

const mockPdfData = {
  text: 'line 1\nline 2\nline 3',
  pageCount: 2,
  warnings: [] as string[],
  fileName: 'test-calendar.pdf',
}
const mockDispatch = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../context/AppContext', async () => {
  const actual = await vi.importActual('../context/AppContext')
  return {
    ...actual,
    useAppContext: () => ({
      state: {
        pdfData: mockPdfData,
        selectedTemplate: null,
      },
      dispatch: mockDispatch,
    }),
  }
})

vi.mock('../services/communityTemplates', () => ({
  fetchCommunityTemplates: vi.fn().mockResolvedValue([]),
  searchCommunityTemplates: vi.fn().mockReturnValue([]),
}))

describe('TemplateSelectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(communityTemplates.fetchCommunityTemplates).mockResolvedValue([])
    vi.mocked(communityTemplates.searchCommunityTemplates).mockReturnValue([])
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <TemplateSelectionPage />
      </MemoryRouter>
    )
  }

  it('displays PDF info banner', () => {
    renderPage()
    expect(screen.getByText(/PDF loaded:/)).toBeInTheDocument()
    expect(screen.getByText(/test-calendar\.pdf/)).toBeInTheDocument()
  })

  it('shows the page heading', () => {
    renderPage()
    expect(screen.getByText('How would you like to parse this?')).toBeInTheDocument()
  })

  it('shows empty saved templates message', () => {
    renderPage()
    expect(screen.getByText(/No saved templates yet/)).toBeInTheDocument()
  })

  it('displays saved templates from localStorage', () => {
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    expect(screen.getByText('Test Calendar')).toBeInTheDocument()
    expect(screen.getByText(/1 saved template/)).toBeInTheDocument()
  })

  it('disables Use Selected when nothing is selected', () => {
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    expect(screen.getByText('Use Selected')).toBeDisabled()
  })

  it('enables Use Selected after selecting a template', async () => {
    const user = userEvent.setup()
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    await user.click(screen.getByLabelText('Test Calendar'))
    expect(screen.getByText('Use Selected')).not.toBeDisabled()
  })

  it('dispatches SET_TEMPLATE and navigates on Use Selected', async () => {
    const user = userEvent.setup()
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    await user.click(screen.getByLabelText('Test Calendar'))
    await user.click(screen.getByText('Use Selected'))
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TEMPLATE',
      payload: mockTemplate,
    })
    expect(mockNavigate).toHaveBeenCalledWith('/results')
  })

  it('deletes a saved template after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    await user.click(screen.getByLabelText('Delete Test Calendar'))
    expect(screen.getByText(/No saved templates yet/)).toBeInTheDocument()
  })

  it('does not delete when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    await user.click(screen.getByLabelText('Delete Test Calendar'))
    expect(screen.getByText('Test Calendar')).toBeInTheDocument()
  })

  it('shows community templates section', () => {
    renderPage()
    expect(screen.getByText('Browse community templates')).toBeInTheDocument()
  })

  it('shows search input for community templates', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument()
    })
  })

  it('shows create new template section with wizard CTA', () => {
    renderPage()
    expect(screen.getByText('Create a new template')).toBeInTheDocument()
    expect(screen.getByText('Start Template Wizard')).toBeInTheDocument()
  })

  it('navigates to wizard on Start Template Wizard click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Start Template Wizard'))
    expect(mockNavigate).toHaveBeenCalledWith('/wizard')
  })

  it('navigates back to home on Back to start click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Back to start'))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_PDF_DATA' })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows Import .json button', () => {
    renderPage()
    expect(screen.getByText('Import .json')).toBeInTheDocument()
  })

  it('shows share modal when Share button is clicked', async () => {
    const user = userEvent.setup()
    templateStorage.saveTemplate('test-cal', mockTemplate)
    renderPage()
    await user.click(screen.getByLabelText('Share Test Calendar'))
    expect(screen.getByText('Share to Community')).toBeInTheDocument()
    expect(screen.getByText('Copy JSON')).toBeInTheDocument()
    expect(screen.getByText('Open GitHub Issue')).toBeInTheDocument()
  })
})
