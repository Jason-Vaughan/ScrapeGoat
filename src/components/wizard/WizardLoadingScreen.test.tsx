import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WizardLoadingScreen } from './WizardLoadingScreen'

describe('WizardLoadingScreen', () => {
  it('renders spinner and heading', () => {
    render(<WizardLoadingScreen />)
    expect(screen.getByText('Analyzing your document')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not show timeout warning below 30 seconds', () => {
    render(<WizardLoadingScreen elapsedSeconds={29} />)
    expect(screen.queryByText('This is taking longer than usual...')).not.toBeInTheDocument()
  })

  it('shows warning message at 30 seconds', () => {
    render(<WizardLoadingScreen elapsedSeconds={30} />)
    expect(screen.getByText('This is taking longer than usual...')).toBeInTheDocument()
  })

  it('shows warning but no cancel button between 30-44 seconds', () => {
    render(<WizardLoadingScreen elapsedSeconds={35} onCancel={vi.fn()} />)
    expect(screen.getByText('This is taking longer than usual...')).toBeInTheDocument()
    expect(screen.queryByText('Cancel request')).not.toBeInTheDocument()
  })

  it('shows "Still working" and cancel button at 45 seconds', () => {
    const onCancel = vi.fn()
    render(<WizardLoadingScreen elapsedSeconds={45} onCancel={onCancel} />)
    expect(screen.getByText('Still working on it...')).toBeInTheDocument()
    expect(screen.getByText('Cancel request')).toBeInTheDocument()
    // Warning from 30s range should NOT be shown (replaced by 45s message)
    expect(screen.queryByText('This is taking longer than usual...')).not.toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<WizardLoadingScreen elapsedSeconds={50} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel request'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not show cancel button when onCancel is not provided', () => {
    render(<WizardLoadingScreen elapsedSeconds={60} />)
    expect(screen.getByText('Still working on it...')).toBeInTheDocument()
    expect(screen.queryByText('Cancel request')).not.toBeInTheDocument()
  })
})
