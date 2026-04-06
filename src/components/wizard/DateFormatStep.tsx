import type { AiAnalysis, AiDateFormat } from '../../hooks/useWizardReducer'

interface DateFormatStepProps {
  analysis: AiAnalysis
  selected: { pattern: string; format?: string } | null
  onSelect: (value: { pattern: string; format?: string }) => void
}

/**
 * Screen 3b: Date format selection.
 * User picks which date pattern matches their calendar.
 * Highlights ambiguous dates where day <= 12.
 */
export function DateFormatStep({
  analysis,
  selected,
  onSelect,
}: DateFormatStepProps) {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Which date format matches your calendar?
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        We detected these date patterns in your document.
      </p>

      <div className="mt-6 space-y-3" role="radiogroup" aria-label="Date format">
        {analysis.dateFormats.detected.map((fmt) => (
          <DateFormatOption
            key={fmt.pattern}
            format={fmt}
            isSelected={selected?.pattern === fmt.pattern}
            onSelect={() =>
              onSelect({ pattern: fmt.pattern, format: fmt.format })
            }
          />
        ))}
      </div>
    </div>
  )
}

interface DateFormatOptionProps {
  format: AiDateFormat
  isSelected: boolean
  onSelect: () => void
}

/**
 * A single date format radio option with examples and ambiguity warning.
 */
function DateFormatOption({
  format,
  isSelected,
  onSelect,
}: DateFormatOptionProps) {
  const hasAmbiguous = format.examples.some(isAmbiguousDate)

  return (
    <label
      className={`flex cursor-pointer rounded-lg border p-4 transition-colors ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-surface-dim hover:border-on-surface-muted'
      }`}
    >
      <input
        type="radio"
        name="dateFormat"
        checked={isSelected}
        onChange={onSelect}
        className="mt-0.5 shrink-0 accent-primary"
      />
      <div className="ml-3">
        <span className="font-medium text-on-surface">{format.label}</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {format.examples.map((ex, i) => (
            <code
              key={i}
              className={`rounded px-2 py-0.5 text-xs ${
                isAmbiguousDate(ex)
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-dim text-on-surface-muted'
              }`}
            >
              {ex}
            </code>
          ))}
        </div>
        {hasAmbiguous && (
          <p className="mt-2 text-xs text-accent">
            Some dates are ambiguous (day &le; 12) — could be month/day or
            day/month.
          </p>
        )}
      </div>
    </label>
  )
}

/**
 * Check if a date string could be ambiguous (both month and day values <= 12).
 * Only checks slash-separated patterns like 03/05/2026.
 */
function isAmbiguousDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\//)
  if (!match) return false
  const a = parseInt(match[1], 10)
  const b = parseInt(match[2], 10)
  return a <= 12 && b <= 12 && a !== b
}
