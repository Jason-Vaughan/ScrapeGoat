import type { AiAnalysis } from '../../hooks/useWizardReducer'

interface DocumentStructureStepProps {
  analysis: AiAnalysis
  selected: string | null
  onSelect: (value: string) => void
}

/**
 * Screen 3a: Document structure selection.
 * User picks how the PDF calendar is organized (block, table, or list).
 */
export function DocumentStructureStep({
  analysis,
  selected,
  onSelect,
}: DocumentStructureStepProps) {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        How is this calendar organized?
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        Select the layout that best matches your PDF.
      </p>

      <div className="mt-6 space-y-3" role="radiogroup" aria-label="Document structure">
        {analysis.documentStructure.options.map((option) => (
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
              name="documentStructure"
              value={option.value}
              checked={selected === option.value}
              onChange={() => onSelect(option.value)}
              className="mt-0.5 shrink-0 accent-primary"
            />
            <div className="ml-3">
              <span className="font-medium text-on-surface">{option.label}</span>
              <code className="mt-1 block rounded bg-surface-dim px-2 py-1 text-xs text-on-surface-muted">
                {option.source}
              </code>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
