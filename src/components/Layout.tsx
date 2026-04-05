import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

interface LayoutProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

/**
 * Root layout wrapper. Provides header, footer, skip-to-content link,
 * and responsive main content area.
 */
export function Layout({ theme, onToggleTheme }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <Header theme={theme} onToggleTheme={onToggleTheme} />
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
