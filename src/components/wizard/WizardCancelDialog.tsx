import { useFocusTrap } from '../../hooks/useFocusTrap'

interface WizardCancelDialogProps {
  open: boolean
  onStay: () => void
  onLeave: () => void
}

/**
 * Modal confirmation dialog shown when the user tries to cancel the wizard.
 * Warns that progress will be lost. Focus is trapped within while open.
 */
export function WizardCancelDialog({
  open,
  onStay,
  onLeave,
}: WizardCancelDialogProps) {
  const trapRef = useFocusTrap(open)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onStay()
      }}
    >
      <div ref={trapRef} className="mx-4 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
        <h3
          id="cancel-dialog-title"
          className="font-heading text-lg font-semibold text-on-surface"
        >
          Leave the wizard?
        </h3>
        <p className="mt-2 text-sm text-on-surface-muted">
          Your progress will be lost. You can always start the wizard again
          later.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onStay}
            className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-dim transition-colors"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
