import { Link, NavLink } from 'react-router-dom'

interface HeaderProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

/**
 * App header with logo, navigation links, and dark/light mode toggle.
 */
export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="bg-surface-dim border-b border-on-surface/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-primary font-heading font-bold text-xl">
          ScrapeGoat
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `text-sm font-medium transition-colors ${isActive ? 'text-primary' : 'text-on-surface-muted hover:text-on-surface'}`
            }
          >
            Home
          </NavLink>

          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="rounded-md p-2 text-on-surface-muted hover:text-on-surface hover:bg-surface-bright transition-colors"
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 118.24 2.263a.75.75 0 01.77.26z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  )
}
