import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SaveTemplateStep } from './SaveTemplateStep'
import { FailurePage } from './FailurePage'
import { CorrectionStep } from './CorrectionStep'
import type { FlaggedEvent } from '../../hooks/useWizardReducer'

describe('SaveTemplateStep', () => {
  const defaultProps = {
    templateName: '',
    saveOptions: { browser: true, download: false, share: false },
    eventCount: 47,
    onNameChange: vi.fn(),
    onOptionsChange: vi.fn(),
    onSave: vi.fn(),
  }

  it('renders success message with event count', () => {
    render(<SaveTemplateStep {...defaultProps} />)
    expect(screen.getByText(/Template built successfully/)).toBeInTheDocument()
    expect(screen.getByText(/47 events parsed/)).toBeInTheDocument()
  })

  it('renders name input', () => {
    render(<SaveTemplateStep {...defaultProps} />)
    expect(screen.getByPlaceholderText(/Javits Center/)).toBeInTheDocument()
  })

  it('calls onNameChange when name is typed', () => {
    const onNameChange = vi.fn()
    render(<SaveTemplateStep {...defaultProps} onNameChange={onNameChange} />)
    fireEvent.change(screen.getByPlaceholderText(/Javits Center/), {
      target: { value: 'My Template' },
    })
    expect(onNameChange).toHaveBeenCalledWith('My Template')
  })

  it('disables save button when name is empty', () => {
    render(<SaveTemplateStep {...defaultProps} templateName="" />)
    expect(screen.getByText('Save & Continue to Results')).toBeDisabled()
  })

  it('enables save button when name is provided', () => {
    render(<SaveTemplateStep {...defaultProps} templateName="Test" />)
    expect(screen.getByText('Save & Continue to Results')).not.toBeDisabled()
  })

  it('calls onSave when save button is clicked', () => {
    const onSave = vi.fn()
    render(
      <SaveTemplateStep {...defaultProps} templateName="Test" onSave={onSave} />
    )
    fireEvent.click(screen.getByText('Save & Continue to Results'))
    expect(onSave).toHaveBeenCalled()
  })

  it('renders three save option checkboxes', () => {
    render(<SaveTemplateStep {...defaultProps} />)
    expect(screen.getByText('Save to this browser')).toBeInTheDocument()
    expect(screen.getByText('Download as file')).toBeInTheDocument()
    expect(screen.getByText('Share to community library')).toBeInTheDocument()
  })

  it('calls onOptionsChange when checkbox toggled', () => {
    const onOptionsChange = vi.fn()
    render(
      <SaveTemplateStep
        {...defaultProps}
        onOptionsChange={onOptionsChange}
      />
    )
    fireEvent.click(screen.getByText('Download as file'))
    expect(onOptionsChange).toHaveBeenCalledWith({ download: true })
  })

  it('pluralizes event count correctly for 1 event', () => {
    render(<SaveTemplateStep {...defaultProps} eventCount={1} />)
    expect(screen.getByText(/1 event parsed/)).toBeInTheDocument()
  })
})

describe('FailurePage', () => {
  const defaultAnswers = {
    documentStructure: 'block' as const,
    dateFormat: null,
    timezone: null,
    locations: [],
    statusCodes: [],
    eventNamePosition: null,
  }

  const defaultProps = {
    error: { type: 'generic' as const, message: 'Something went wrong' },
    answers: defaultAnswers,
    onRetry: vi.fn(),
    onStartOver: vi.fn(),
    onGoHome: vi.fn(),
  }

  it('shows generic error message', () => {
    render(<FailurePage {...defaultProps} />)
    expect(
      screen.getByText("We couldn't fully parse this calendar")
    ).toBeInTheDocument()
  })

  it('shows rate limited message', () => {
    render(
      <FailurePage
        {...defaultProps}
        error={{ type: 'rate_limited', message: 'Too many requests' }}
      />
    )
    expect(
      screen.getByText('Template builder temporarily busy')
    ).toBeInTheDocument()
  })

  it('shows api down message', () => {
    render(
      <FailurePage
        {...defaultProps}
        error={{ type: 'api_down', message: 'Down' }}
      />
    )
    expect(
      screen.getByText('Template builder unavailable')
    ).toBeInTheDocument()
  })

  it('calls onRetry when try again clicked', () => {
    const onRetry = vi.fn()
    render(<FailurePage {...defaultProps} onRetry={onRetry} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('calls onGoHome when go home clicked', () => {
    const onGoHome = vi.fn()
    render(<FailurePage {...defaultProps} onGoHome={onGoHome} />)
    fireEvent.click(screen.getByText('Go home'))
    expect(onGoHome).toHaveBeenCalled()
  })

  it('shows bug report form when report button clicked', () => {
    render(<FailurePage {...defaultProps} />)
    fireEvent.click(screen.getByText('Report this issue'))
    expect(screen.getByText('Submit report')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/additional details/i)).toBeInTheDocument()
  })

  it('shows PDF privacy warning in report form', () => {
    render(<FailurePage {...defaultProps} />)
    fireEvent.click(screen.getByText('Report this issue'))
    expect(
      screen.getByText(/publicly visible on GitHub/)
    ).toBeInTheDocument()
  })

  it('shows "what still works" note', () => {
    render(<FailurePage {...defaultProps} />)
    expect(
      screen.getByText(/try again with different settings/)
    ).toBeInTheDocument()
  })
})

describe('CorrectionStep', () => {
  const flagged: FlaggedEvent[] = [
    {
      eventId: 'e1',
      issues: [],
      correctionRound: 0,
      resolved: false,
      corrections: [],
    },
  ]

  const testResults = [
    {
      id: 'e1',
      name: 'Test Event',
      startDate: '2026-03-15',
      endDate: null,
      moveInDate: null,
      moveOutDate: null,
      location: 'Hall A',
      status: null,
      customFields: {},
      rawText: 'Test Event\nMarch 15, 2026\nHall A',
      warnings: [],
      isSelected: true,
    },
  ]

  it('renders the flagged event name', () => {
    render(
      <CorrectionStep
        flaggedEvents={flagged}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={vi.fn()}
        onAdvance={vi.fn()}
      />
    )
    expect(screen.getByText(/Fix:.*Test Event/)).toBeInTheDocument()
  })

  it('shows issue checkboxes', () => {
    render(
      <CorrectionStep
        flaggedEvents={flagged}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={vi.fn()}
        onAdvance={vi.fn()}
      />
    )
    expect(screen.getByText('Event name')).toBeInTheDocument()
    expect(screen.getByText('Dates')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('disables "Find alternatives" when no issues selected', () => {
    render(
      <CorrectionStep
        flaggedEvents={flagged}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={vi.fn()}
        onAdvance={vi.fn()}
      />
    )
    expect(screen.getByText('Find alternatives')).toBeDisabled()
  })

  it('enables "Find alternatives" when issues selected', () => {
    render(
      <CorrectionStep
        flaggedEvents={flagged}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={vi.fn()}
        onAdvance={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Dates'))
    expect(screen.getByText('Find alternatives')).not.toBeDisabled()
  })

  it('shows exhausted view when correction rounds exceeded', () => {
    const exhausted: FlaggedEvent[] = [
      { ...flagged[0], correctionRound: 3 },
    ]
    render(
      <CorrectionStep
        flaggedEvents={exhausted}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={vi.fn()}
        onAdvance={vi.fn()}
      />
    )
    expect(screen.getByText(/tried our best/)).toBeInTheDocument()
  })

  it('skip button resolves and advances', () => {
    const onResolve = vi.fn()
    const onAdvance = vi.fn()
    render(
      <CorrectionStep
        flaggedEvents={flagged}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={onResolve}
        onAdvance={onAdvance}
      />
    )
    fireEvent.click(screen.getByText('Skip this event'))
    expect(onResolve).toHaveBeenCalledWith('e1')
    expect(onAdvance).toHaveBeenCalled()
  })

  it('returns null when no flagged event at index', () => {
    const { container } = render(
      <CorrectionStep
        flaggedEvents={[]}
        currentIndex={0}
        testResults={testResults}
        onSetCorrections={vi.fn()}
        onResolve={vi.fn()}
        onAdvance={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
