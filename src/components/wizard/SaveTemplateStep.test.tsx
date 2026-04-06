import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SaveTemplateStep } from './SaveTemplateStep'

const defaultProps = {
  templateName: '',
  saveOptions: { browser: true, download: false, share: false },
  eventCount: 10,
  onNameChange: vi.fn(),
  onOptionsChange: vi.fn(),
  onSave: vi.fn(),
}

describe('SaveTemplateStep', () => {
  it('shows AI-suggested name button when no name entered and suggestion available', () => {
    render(
      <SaveTemplateStep
        {...defaultProps}
        suggestedName="Convention Center Schedule"
      />
    )
    expect(
      screen.getByText(/Use suggested:.*Convention Center Schedule/)
    ).toBeInTheDocument()
  })

  it('clicking suggested name calls onNameChange with suggestion', () => {
    const onNameChange = vi.fn()
    render(
      <SaveTemplateStep
        {...defaultProps}
        suggestedName="My Calendar"
        onNameChange={onNameChange}
      />
    )
    fireEvent.click(screen.getByTestId('suggested-name-button'))
    expect(onNameChange).toHaveBeenCalledWith('My Calendar')
  })

  it('hides suggested name when user has typed a name', () => {
    render(
      <SaveTemplateStep
        {...defaultProps}
        templateName="User Typed"
        suggestedName="AI Suggestion"
      />
    )
    expect(screen.queryByTestId('suggested-name-button')).not.toBeInTheDocument()
  })

  it('hides suggested name when no suggestion provided', () => {
    render(
      <SaveTemplateStep
        {...defaultProps}
        suggestedName={null}
      />
    )
    expect(screen.queryByTestId('suggested-name-button')).not.toBeInTheDocument()
  })

  it('disables save button when name is empty', () => {
    render(<SaveTemplateStep {...defaultProps} />)
    expect(screen.getByText('Save & Continue to Results')).toBeDisabled()
  })

  it('enables save button when name is provided', () => {
    render(<SaveTemplateStep {...defaultProps} templateName="My Template" />)
    expect(screen.getByText('Save & Continue to Results')).not.toBeDisabled()
  })
})
