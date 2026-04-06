import { useState } from 'react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

/**
 * PWA install banner. Shows when the browser offers an install prompt
 * and the user hasn't dismissed it.
 */
export function InstallBanner() {
  const { canInstall, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (!canInstall || dismissed) return null

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-on-surface/10 bg-surface-dim px-4 py-3"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-on-surface">
          Install ScrapeGoat for quick access — works offline for parsing and exporting.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="rounded px-3 py-1.5 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
          >
            Not now
          </button>
          <button
            onClick={install}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
