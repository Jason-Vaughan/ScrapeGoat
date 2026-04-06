import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from './useFocusTrap'

function TestDialog({ active }: { active: boolean }) {
  const ref = useFocusTrap(active)
  return (
    <div>
      <button>Outside</button>
      {active && (
        <div ref={ref} role="dialog">
          <button>First</button>
          <button>Second</button>
          <button>Third</button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('focuses the first element when activated', () => {
    render(<TestDialog active={true} />)
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('wraps focus from last to first on Tab', async () => {
    const user = userEvent.setup()
    render(<TestDialog active={true} />)

    // Focus should be on First
    expect(screen.getByText('First')).toHaveFocus()

    // Tab to Second
    await user.tab()
    expect(screen.getByText('Second')).toHaveFocus()

    // Tab to Third
    await user.tab()
    expect(screen.getByText('Third')).toHaveFocus()

    // Tab should wrap to First
    await user.tab()
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('wraps focus from first to last on Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<TestDialog active={true} />)

    // Focus should be on First, Shift+Tab should go to Third
    expect(screen.getByText('First')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByText('Third')).toHaveFocus()
  })

  it('does not trap focus when inactive', () => {
    render(<TestDialog active={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
