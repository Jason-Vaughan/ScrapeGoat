import type { AiAnalysis, AiCandidate } from '../../hooks/useWizardReducer'

interface LocationsStepProps {
  analysis: AiAnalysis
  selected: string[]
  onSelect: (locations: string[]) => void
}

/**
 * Screen 3d: Locations / facilities selection.
 * Checkbox multi-select from AI-detected location candidates.
 * High-confidence candidates are pre-checked.
 */
export function LocationsStep({
  analysis,
  selected,
  onSelect,
}: LocationsStepProps) {
  /** Toggle a single location in the selection. */
  function handleToggle(name: string) {
    if (selected.includes(name)) {
      onSelect(selected.filter((l) => l !== name))
    } else {
      onSelect([...selected, name])
    }
  }

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Which of these are venue or room names?
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        Check all locations that appear in your calendar. We pre-selected the
        ones we&apos;re most confident about.
      </p>

      <div className="mt-6 space-y-2" role="group" aria-label="Locations">
        {analysis.locations.candidates.map((candidate) => (
          <CandidateCheckbox
            key={candidate.name}
            candidate={candidate}
            checked={selected.includes(candidate.name)}
            onChange={() => handleToggle(candidate.name)}
          />
        ))}
      </div>

      {analysis.locations.candidates.length === 0 && (
        <p className="mt-6 text-sm text-on-surface-muted">
          No location candidates were detected. You can skip this step.
        </p>
      )}
    </div>
  )
}

interface CandidateCheckboxProps {
  candidate: AiCandidate
  checked: boolean
  onChange: () => void
}

/**
 * A single candidate checkbox with confidence badge and source snippet.
 */
function CandidateCheckbox({
  candidate,
  checked,
  onChange,
}: CandidateCheckboxProps) {
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
          <ConfidenceBadge confidence={candidate.confidence} />
        </div>
        <code className="mt-1 block rounded bg-surface-dim px-2 py-1 text-xs text-on-surface-muted">
          {candidate.source}
        </code>
      </div>
    </label>
  )
}

/** Confidence level badge with color coding. */
function ConfidenceBadge({
  confidence,
}: {
  confidence: 'high' | 'medium' | 'low'
}) {
  const styles = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[confidence]}`}>
      {confidence}
    </span>
  )
}
