import type { AiAnalysis, AiCandidate } from '../../hooks/useWizardReducer'

interface StatusCodesStepProps {
  analysis: AiAnalysis
  selected: string[]
  onSelect: (codes: string[]) => void
}

/**
 * Screen 3e: Status codes selection.
 * Checkbox multi-select from AI-detected status code candidates.
 * Same UI pattern as LocationsStep.
 */
export function StatusCodesStep({
  analysis,
  selected,
  onSelect,
}: StatusCodesStepProps) {
  /** Toggle a single status code in the selection. */
  function handleToggle(name: string) {
    if (selected.includes(name)) {
      onSelect(selected.filter((s) => s !== name))
    } else {
      onSelect([...selected, name])
    }
  }

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Which of these are event statuses?
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        Check all status labels that appear in your calendar.
      </p>

      <div className="mt-6 space-y-2" role="group" aria-label="Status codes">
        {analysis.statusCodes.candidates.map((candidate) => (
          <StatusCheckbox
            key={candidate.name}
            candidate={candidate}
            checked={selected.includes(candidate.name)}
            onChange={() => handleToggle(candidate.name)}
          />
        ))}
      </div>

      {analysis.statusCodes.candidates.length === 0 && (
        <p className="mt-6 text-sm text-on-surface-muted">
          No status codes were detected. You can skip this step.
        </p>
      )}
    </div>
  )
}

interface StatusCheckboxProps {
  candidate: AiCandidate
  checked: boolean
  onChange: () => void
}

/**
 * A single status code checkbox with confidence badge and source snippet.
 */
function StatusCheckbox({
  candidate,
  checked,
  onChange,
}: StatusCheckboxProps) {
  const confidenceStyles = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <label
      className={`flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${
        checked
          ? 'border-primary bg-primary/5'
          : 'border-surface-dim hover:border-on-surface-muted'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 shrink-0 accent-primary"
      />
      <div className="ml-3 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-on-surface">{candidate.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              confidenceStyles[candidate.confidence]
            }`}
          >
            {candidate.confidence}
          </span>
        </div>
        <code className="mt-1 block rounded bg-surface-dim px-2 py-1 text-xs text-on-surface-muted">
          {candidate.source}
        </code>
      </div>
    </label>
  )
}
