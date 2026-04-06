import { QUIZ_STEPS, type WizardStepId } from '../../hooks/useWizardReducer'

interface WizardNavBarProps {
  currentStep: WizardStepId
  canNext: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onCancel: () => void
}

/**
 * Bottom navigation bar for wizard steps.
 * Shows Back / Skip / Next buttons with appropriate enabled states.
 */
export function WizardNavBar({
  currentStep,
  canNext,
  onNext,
  onPrev,
  onSkip,
  onCancel,
}: WizardNavBarProps) {
  const stepIndex = QUIZ_STEPS.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isQuizStep = stepIndex !== -1

  return (
    <div className="mt-8 flex items-center justify-between border-t border-surface-dim pt-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
        >
          Cancel
        </button>
        {!isFirstStep && (
          <button
            type="button"
            onClick={onPrev}
            className="rounded-lg px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
          >
            Back
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {isQuizStep && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
