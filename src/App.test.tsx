import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { WizardPage } from './pages/WizardPage'
import { ResultsPage } from './pages/ResultsPage'
import { ExportPage } from './pages/ExportPage'

/**
 * Renders the app routes inside a MemoryRouter with a static theme.
 */
function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<Layout theme="light" onToggleTheme={() => {}} />}>
          <Route index element={<HomePage />} />
          <Route path="wizard" element={<WizardPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

/**
 * Renders the app with live theme state for toggle tests.
 */
function ThemeTestApp() {
  const { theme, toggleTheme } = useTheme()
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
          <Route index element={<HomePage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('App Shell', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('renders the header with ScrapeGoat logo link', () => {
    renderApp()
    const logo = screen.getByRole('link', { name: /scrapegoat/i })
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('href', '/')
  })

  it('renders the footer with attribution', () => {
    renderApp()
    expect(screen.getByText(/jason vaughan/i)).toBeInTheDocument()
    expect(screen.getByText(/open source on github/i)).toBeInTheDocument()
  })

  it('renders skip-to-content link', () => {
    renderApp()
    const skipLink = screen.getByText('Skip to content')
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('has an accessible main content landmark', () => {
    renderApp()
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })
})

describe('Home page', () => {
  it('renders the heading and drop zone', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: /scrapegoat/i })).toBeInTheDocument()
    expect(screen.getByText(/drop your pdf here/i)).toBeInTheDocument()
  })
})

describe('Routing', () => {
  it('renders wizard page at /wizard', () => {
    renderApp(['/wizard'])
    expect(screen.getByRole('heading', { name: /configure extraction/i })).toBeInTheDocument()
  })

  it('renders results page at /results', () => {
    renderApp(['/results'])
    expect(screen.getByRole('heading', { name: /extracted events/i })).toBeInTheDocument()
  })

  it('renders export page at /export', () => {
    renderApp(['/export'])
    expect(screen.getByRole('heading', { name: /export calendar/i })).toBeInTheDocument()
  })

  it('renders 404 for unknown routes', () => {
    renderApp(['/this-does-not-exist'])
    expect(screen.getByText('This page has been scraped clean.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
  })

  it('404 page has a link back home', () => {
    renderApp(['/nope'])
    const homeLink = screen.getByRole('link', { name: /go home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })
})

describe('Dark mode toggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('renders the theme toggle button', () => {
    renderApp()
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('clicking toggle adds dark class and updates button label', async () => {
    const user = userEvent.setup()
    render(<ThemeTestApp />)

    const btn = screen.getByRole('button', { name: /switch to dark mode/i })
    await user.click(btn)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
    expect(localStorage.getItem('scrapegoat-theme')).toBe('dark')
  })

  it('clicking toggle twice returns to light mode', async () => {
    const user = userEvent.setup()
    render(<ThemeTestApp />)

    const btn = screen.getByRole('button', { name: /switch to dark mode/i })
    await user.click(btn)
    await user.click(screen.getByRole('button', { name: /switch to light mode/i }))

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('scrapegoat-theme')).toBe('light')
  })
})

describe('Navigation', () => {
  it('Home nav link navigates to home page', async () => {
    const user = userEvent.setup()
    renderApp(['/wizard'])
    expect(screen.getByRole('heading', { name: /configure extraction/i })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /^home$/i }))
    expect(screen.getByRole('heading', { name: /scrapegoat/i })).toBeInTheDocument()
  })
})
