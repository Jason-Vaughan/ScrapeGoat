import { useEffect, useState } from 'react'
import { LOADING_TIPS } from '../../hooks/useWizardReducer'

/** Interval between tip rotations (ms). */
const TIP_INTERVAL = 3000

/** Elapsed seconds thresholds for timeout UX. */
const TIMEOUT_WARNING_SECONDS = 30
const TIMEOUT_CANCEL_SECONDS = 45

interface WizardLoadingScreenProps {
  /** Elapsed seconds since the request started. 0 = no timeout tracking. */
  elapsedSeconds?: number
  /** Called when user clicks "Cancel" after the cancel threshold. */
  onCancel?: () => void
}

/**
 * Loading screen shown while AI analysis is in progress.
 * Displays a spinner, rotating tip messages, and progressive timeout UX.
 */
export function WizardLoadingScreen({
  elapsedSeconds = 0,
  onCancel,
}: WizardLoadingScreenProps) {
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length)
    }, TIP_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-20" role="status">
      <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-surface-dim border-t-primary" />
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Analyzing your document
      </h2>
      <p className="mt-3 text-on-surface-muted transition-opacity" aria-live="polite">
        {LOADING_TIPS[tipIndex]}
      </p>

      {/* Timeout warning at 30s */}
      {elapsedSeconds >= TIMEOUT_WARNING_SECONDS && elapsedSeconds < TIMEOUT_CANCEL_SECONDS && (
        <p className="mt-6 text-sm text-accent" aria-live="polite">
          This is taking longer than usual...
        </p>
      )}

      {/* Cancel option at 45s */}
      {elapsedSeconds >= TIMEOUT_CANCEL_SECONDS && (
        <div className="mt-6 text-center" aria-live="polite">
          <p className="text-sm text-accent">
            Still working on it...
          </p>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 rounded-lg border border-surface-dim px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
            >
              Cancel request
            </button>
          )}
        </div>
      )}
    </div>
  )
}
