import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallBanner } from './InstallBanner'

// Mock the hook so we can control canInstall
vi.mock('../hooks/useInstallPrompt', () => ({
  useInstallPrompt: vi.fn(),
}))

import { useInstallPrompt } from '../hooks/useInstallPrompt'
const mockUseInstallPrompt = vi.mocked(useInstallPrompt)

describe('InstallBanner', () => {
  it('renders nothing when install is not available', () => {
    mockUseInstallPrompt.mockReturnValue({ canInstall: false, install: vi.fn() })
    const { container } = render(<InstallBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders banner when install is available', () => {
    mockUseInstallPrompt.mockReturnValue({ canInstall: true, install: vi.fn() })
    render(<InstallBanner />)
    expect(screen.getByText(/Install ScrapeGoat/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })

  it('calls install when Install button is clicked', async () => {
    const installFn = vi.fn()
    mockUseInstallPrompt.mockReturnValue({ canInstall: true, install: installFn })
    render(<InstallBanner />)

    await userEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(installFn).toHaveBeenCalled()
  })

  it('hides banner when Not now is clicked', async () => {
    mockUseInstallPrompt.mockReturnValue({ canInstall: true, install: vi.fn() })
    render(<InstallBanner />)

    expect(screen.getByText(/Install ScrapeGoat/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/Install ScrapeGoat/)).not.toBeInTheDocument()
  })
})
