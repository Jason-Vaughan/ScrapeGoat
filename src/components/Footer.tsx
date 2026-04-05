/**
 * App footer with open source link and attribution.
 */
export function Footer() {
  return (
    <footer className="border-t border-on-surface/10 bg-surface-dim">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-sm text-on-surface-muted sm:flex-row sm:justify-between sm:px-6">
        <p>
          Made by{' '}
          <a
            href="https://github.com/Jason-Vaughan"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-on-surface hover:text-primary transition-colors"
          >
            Jason Vaughan
          </a>
        </p>
        <a
          href="https://github.com/Jason-Vaughan/ScrapeGoat"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-on-surface hover:text-primary transition-colors"
        >
          Open Source on GitHub
        </a>
      </div>
    </footer>
  )
}
