import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentStructureStep } from './DocumentStructureStep'
import { DateFormatStep } from './DateFormatStep'
import { TimezoneStep } from './TimezoneStep'
import { LocationsStep } from './LocationsStep'
import { StatusCodesStep } from './StatusCodesStep'
import { EventNamesStep } from './EventNamesStep'
import type { AiAnalysis } from '../../hooks/useWizardReducer'

/** Minimal mock analysis for step tests. */
function mockAnalysis(): AiAnalysis {
  return {
    documentStructure: {
      options: [
        { label: 'Block layout', value: 'block', source: 'Event A\nMarch 15...' },
        { label: 'Table layout', value: 'table', source: '| Event | Date |' },
        { label: 'List layout', value: 'list', source: '- Event A, March 15' },
      ],
    },
    dateFormats: {
      detected: [
        {
          label: 'MM/DD/YYYY',
          pattern: '\\d+/\\d+/\\d+',
          format: 'MM/DD/YYYY',
          examples: ['03/15/2026', '04/05/2026'],
          source: '03/15/2026',
        },
        {
          label: 'DD/MM/YYYY',
          pattern: '\\d+/\\d+/\\d+',
          format: 'DD/MM/YYYY',
          examples: ['15/03/2026'],
          source: '15/03/2026',
        },
      ],
    },
    locations: {
      candidates: [
        { name: 'Hall A', confidence: 'high', source: 'Hall A setup' },
        { name: 'Room 101', confidence: 'medium', source: 'in Room 101' },
      ],
    },
    statusCodes: {
      candidates: [
        { name: 'Confirmed', confidence: 'high', source: 'Status: Confirmed' },
        { name: 'Tentative', confidence: 'low', source: '(Tentative)' },
      ],
    },
    eventNames: {
      candidates: [
        { name: 'Tech Conference', source: 'Tech Conference\nMarch 15-17' },
        { name: 'Board Meeting', source: 'Board Meeting\nMay 1' },
      ],
    },
    estimatedEventCount: 10,
    detectedTimezone: 'America/New_York',
    notes: null,
  }
}

describe('DocumentStructureStep', () => {
  it('renders all structure options', () => {
    render(
      <DocumentStructureStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Block layout')).toBeInTheDocument()
    expect(screen.getByText('Table layout')).toBeInTheDocument()
    expect(screen.getByText('List layout')).toBeInTheDocument()
  })

  it('calls onSelect when an option is clicked', () => {
    const onSelect = vi.fn()
    render(
      <DocumentStructureStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Block layout'))
    expect(onSelect).toHaveBeenCalledWith('block')
  })

  it('highlights the selected option', () => {
    render(
      <DocumentStructureStep
        analysis={mockAnalysis()}
        selected="table"
        onSelect={() => {}}
      />
    )
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const tableRadio = radios.find((r) => r.value === 'table')
    expect(tableRadio?.checked).toBe(true)
  })
})

describe('DateFormatStep', () => {
  it('renders detected date formats', () => {
    render(
      <DateFormatStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('MM/DD/YYYY')).toBeInTheDocument()
    expect(screen.getByText('DD/MM/YYYY')).toBeInTheDocument()
  })

  it('shows example dates', () => {
    render(
      <DateFormatStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('03/15/2026')).toBeInTheDocument()
  })

  it('calls onSelect with pattern and format', () => {
    const onSelect = vi.fn()
    render(
      <DateFormatStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('MM/DD/YYYY'))
    expect(onSelect).toHaveBeenCalledWith({
      pattern: '\\d+/\\d+/\\d+',
      format: 'MM/DD/YYYY',
    })
  })

  it('shows ambiguity warning for ambiguous dates', () => {
    const analysis = mockAnalysis()
    // 04/05/2026 is ambiguous (both 4 and 5 <= 12)
    analysis.dateFormats.detected[0].examples = ['04/05/2026']
    render(
      <DateFormatStep
        analysis={analysis}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText(/ambiguous/i)).toBeInTheDocument()
  })
})

describe('TimezoneStep', () => {
  it('renders common timezone options', () => {
    render(
      <TimezoneStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText(/New York/)).toBeInTheDocument()
    expect(screen.getByText(/Chicago/)).toBeInTheDocument()
  })

  it('shows AI-detected timezone badge', () => {
    render(
      <TimezoneStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('AI Detected')).toBeInTheDocument()
  })

  it('calls onSelect when a timezone is clicked', () => {
    const onSelect = vi.fn()
    render(
      <TimezoneStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText(/Chicago/))
    expect(onSelect).toHaveBeenCalledWith('America/Chicago')
  })

  it('has a search input', () => {
    render(
      <TimezoneStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })
})

describe('LocationsStep', () => {
  it('renders location candidates', () => {
    render(
      <LocationsStep
        analysis={mockAnalysis()}
        selected={[]}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Hall A')).toBeInTheDocument()
    expect(screen.getByText('Room 101')).toBeInTheDocument()
  })

  it('shows confidence badges', () => {
    render(
      <LocationsStep
        analysis={mockAnalysis()}
        selected={[]}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
  })

  it('calls onSelect with toggled array on check', () => {
    const onSelect = vi.fn()
    render(
      <LocationsStep
        analysis={mockAnalysis()}
        selected={['Hall A']}
        onSelect={onSelect}
      />
    )
    // Click Room 101 to add it
    fireEvent.click(screen.getByText('Room 101'))
    expect(onSelect).toHaveBeenCalledWith(['Hall A', 'Room 101'])
  })

  it('calls onSelect with removed item on uncheck', () => {
    const onSelect = vi.fn()
    render(
      <LocationsStep
        analysis={mockAnalysis()}
        selected={['Hall A', 'Room 101']}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Hall A'))
    expect(onSelect).toHaveBeenCalledWith(['Room 101'])
  })
})

describe('StatusCodesStep', () => {
  it('renders status code candidates', () => {
    render(
      <StatusCodesStep
        analysis={mockAnalysis()}
        selected={[]}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Tentative')).toBeInTheDocument()
  })

  it('calls onSelect with toggled array', () => {
    const onSelect = vi.fn()
    render(
      <StatusCodesStep
        analysis={mockAnalysis()}
        selected={[]}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Confirmed'))
    expect(onSelect).toHaveBeenCalledWith(['Confirmed'])
  })
})

describe('EventNamesStep', () => {
  it('renders position options', () => {
    render(
      <EventNamesStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('First line of each event block')).toBeInTheDocument()
    expect(screen.getByText('After the date')).toBeInTheDocument()
    expect(screen.getByText('Before the date')).toBeInTheDocument()
  })

  it('shows example event names from AI', () => {
    render(
      <EventNamesStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Tech Conference')).toBeInTheDocument()
    expect(screen.getByText('Board Meeting')).toBeInTheDocument()
  })

  it('calls onSelect with position value', () => {
    const onSelect = vi.fn()
    render(
      <EventNamesStep
        analysis={mockAnalysis()}
        selected={null}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('First line of each event block'))
    expect(onSelect).toHaveBeenCalledWith('first_line')
  })

  it('highlights selected option', () => {
    render(
      <EventNamesStep
        analysis={mockAnalysis()}
        selected="after_date"
        onSelect={() => {}}
      />
    )
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const selected = radios.find((r) => r.value === 'after_date')
    expect(selected?.checked).toBe(true)
  })
})
