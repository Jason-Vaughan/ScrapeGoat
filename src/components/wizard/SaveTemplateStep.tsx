interface SaveTemplateStepProps {
  templateName: string
  saveOptions: { browser: boolean; download: boolean; share: boolean }
  eventCount: number
  onNameChange: (name: string) => void
  onOptionsChange: (options: Partial<{ browser: boolean; download: boolean; share: boolean }>) => void
  onSave: () => void
}

/**
 * Screen 3i: Save template.
 * User provides a name and selects save options (browser, download, share).
 */
export function SaveTemplateStep({
  templateName,
  saveOptions,
  eventCount,
  onNameChange,
  onOptionsChange,
  onSave,
}: SaveTemplateStepProps) {
  return (
    <div>
      {/* Success header */}
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <p className="font-heading text-lg font-semibold text-green-700 dark:text-green-400">
          Template built successfully!
        </p>
        <p className="mt-1 text-sm text-green-600 dark:text-green-500">
          {eventCount} event{eventCount !== 1 ? 's' : ''} parsed from your PDF.
        </p>
      </div>

      {/* Template name */}
      <label className="block">
        <span className="text-sm font-medium text-on-surface">
          Give your template a name:
        </span>
        <input
          type="text"
          value={templateName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Javits Center Event Calendar"
          className="mt-2 w-full rounded-lg border border-surface-dim bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none"
          autoFocus
        />
      </label>

      {/* Save options */}
      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-on-surface">
          Save options:
        </legend>
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={saveOptions.browser}
              onChange={(e) => onOptionsChange({ browser: e.target.checked })}
              className="accent-primary"
            />
            <div>
              <span className="text-sm text-on-surface">
                Save to this browser
              </span>
              <p className="text-xs text-on-surface-muted">
                Use again without setup
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={saveOptions.download}
              onChange={(e) => onOptionsChange({ download: e.target.checked })}
              className="accent-primary"
            />
            <div>
              <span className="text-sm text-on-surface">
                Download as file
              </span>
              <p className="text-xs text-on-surface-muted">
                Keep a backup as .json
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={saveOptions.share}
              onChange={(e) => onOptionsChange({ share: e.target.checked })}
              className="accent-primary"
            />
            <div>
              <span className="text-sm text-on-surface">
                Share to community library
              </span>
              <p className="text-xs text-on-surface-muted">
                Help others with similar calendars
              </p>
            </div>
          </label>
        </div>
      </fieldset>

      {/* Save button */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!templateName.trim()}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          Save &amp; Continue to Results
        </button>
      </div>
    </div>
  )
}
