import type { AiAnalysis } from '../../hooks/useWizardReducer'

interface EventNamesStepProps {
  analysis: AiAnalysis
  selected: string | null
  onSelect: (position: string) => void
}

/** Event name position options with descriptions. */
const POSITION_OPTIONS = [
  {
    value: 'first_line',
    label: 'First line of each event block',
    description: 'Event name appears as the first line before dates and details.',
  },
  {
    value: 'after_date',
    label: 'After the date',
    description: 'Event name follows the date on the same or next line.',
  },
  {
    value: 'before_date',
    label: 'Before the date',
    description: 'Event name appears on the line just above the date.',
  },
  {
    value: 'regex',
    label: 'Custom pattern (advanced)',
    description: 'Event name requires a custom regex pattern to extract.',
  },
]

/**
 * Screen 3f: Event name position selection.
 * User selects where event names appear relative to dates.
 * Shows AI-detected example event names for context.
 */
export function EventNamesStep({
  analysis,
  selected,
  onSelect,
}: EventNamesStepProps) {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Where do event names appear?
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        Select the position that best describes where event names are in each
        entry.
      </p>

      {/* AI-detected example names */}
      {analysis.eventNames.candidates.length > 0 && (
        <div className="mt-4 rounded-lg border border-surface-dim p-4">
          <span className="text-xs font-medium text-on-surface-muted">
            Example event names we found:
          </span>
          <div className="mt-2 space-y-2">
            {analysis.eventNames.candidates.slice(0, 3).map((c, i) => (
              <div key={i}>
                <span className="text-sm font-medium text-on-surface">
                  {c.name}
                </span>
                <code className="ml-2 rounded bg-surface-dim px-2 py-0.5 text-xs text-on-surface-muted">
                  {c.source.slice(0, 60)}
                  {c.source.length > 60 ? '...' : ''}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3" role="radiogroup" aria-label="Event name position">
        {POSITION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer rounded-lg border p-4 transition-colors ${
              selected === option.value
                ? 'border-primary bg-primary/5'
                : 'border-surface-dim hover:border-on-surface-muted'
            }`}
          >
            <input
              type="radio"
              name="eventNamePosition"
              value={option.value}
              checked={selected === option.value}
              onChange={() => onSelect(option.value)}
              className="mt-0.5 shrink-0 accent-primary"
            />
            <div className="ml-3">
              <span className="font-medium text-on-surface">
                {option.label}
              </span>
              <p className="mt-0.5 text-xs text-on-surface-muted">
                {option.description}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
