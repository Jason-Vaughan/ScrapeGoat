import { useEffect, useState } from 'react'
import { LOADING_TIPS } from '../../hooks/useWizardReducer'

/** Interval between tip rotations (ms). */
const TIP_INTERVAL = 3000

/**
 * Loading screen shown while AI analysis is in progress.
 * Displays a spinner and rotating tip messages.
 */
export function WizardLoadingScreen() {
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
    </div>
  )
}
