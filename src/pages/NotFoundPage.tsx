import { Link } from 'react-router-dom'

/**
 * 404 page shown for unmatched routes.
 */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="font-heading text-6xl font-bold text-primary">404</h1>
      <p className="text-xl text-on-surface-muted">
        This page has been scraped clean.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
      >
        Go Home
      </Link>
    </div>
  )
}
