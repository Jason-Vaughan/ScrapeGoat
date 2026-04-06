import { QUIZ_STEPS, type WizardStepId } from '../../hooks/useWizardReducer'

interface WizardProgressProps {
  currentStep: WizardStepId
}

/** Step labels shown in the progress bar. */
const STEP_LABELS = [
  'Structure',
  'Dates',
  'Timezone',
  'Locations',
  'Status',
  'Names',
]

/**
 * Progress bar showing "Step X of 6" for quiz steps.
 * Renders filled/unfilled segments and a label for the current step.
 */
export function WizardProgress({ currentStep }: WizardProgressProps) {
  const stepIndex = QUIZ_STEPS.indexOf(currentStep)
  if (stepIndex === -1) return null

  const stepNumber = stepIndex + 1

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-sm text-on-surface-muted">
        <span>
          Step {stepNumber} of {QUIZ_STEPS.length}
        </span>
        <span>{STEP_LABELS[stepIndex]}</span>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={stepNumber} aria-valuemin={1} aria-valuemax={QUIZ_STEPS.length}>
        {QUIZ_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i <= stepIndex ? 'bg-primary' : 'bg-surface-dim'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
