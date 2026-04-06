import { useState } from 'react'
import type { WizardError, WizardAnswers } from '../../hooks/useWizardReducer'

interface FailurePageProps {
  error: WizardError | null
  answers: WizardAnswers
  onRetry: () => void
  onStartOver: () => void
  onGoHome: () => void
}

/** Graceful degradation messages per error type. */
const ERROR_MESSAGES: Record<
  string,
  { title: string; message: string; note: string }
> = {
  rate_limited: {
    title: 'Template builder temporarily busy',
    message:
      'Our AI assistant is handling a lot of requests right now. Please wait a moment and try again.',
    note: 'Your saved templates and community templates still work — only the AI-powered wizard is affected.',
  },
  api_down: {
    title: 'Template builder unavailable',
    message:
      'The AI service is temporarily down for maintenance.',
    note: 'You can still use saved templates or browse community templates while we work on getting things back.',
  },
  generic: {
    title: "We couldn't fully parse this calendar",
    message:
      'Some PDF formats are tricky — especially scanned documents, unusual layouts, or heavily formatted pages.',
    note: 'You can report this issue so we can improve, or try again with different settings.',
  },
}

/**
 * Screen 3j: Failure / graceful degradation page.
 * Shows appropriate error message, action buttons, and optional bug report form.
 */
export function FailurePage({
  error,
  answers,
  onRetry,
  onStartOver,
  onGoHome,
}: FailurePageProps) {
  const [showReport, setShowReport] = useState(false)
  const [includesPdf, setIncludesPdf] = useState(false)
  const [reportNote, setReportNote] = useState('')

  const errorType = error?.type ?? 'generic'
  const msg = ERROR_MESSAGES[errorType] ?? ERROR_MESSAGES.generic

  /** Build a GitHub issue URL with pre-filled content. */
  function buildIssueUrl(): string {
    const title = encodeURIComponent(
      `Parse failure: ${msg.title}`
    )
    const body = encodeURIComponent(buildIssueBody())
    return `https://github.com/Jason-Vaughan/ScrapeGoat/issues/new?template=parse_failure.md&title=${title}&body=${body}`
  }

  /** Build the issue body with diagnostic info. */
  function buildIssueBody(): string {
    const lines = [
      '## Parse Failure Report',
      '',
      '### Error',
      `- **Type:** ${errorType}`,
      `- **Message:** ${error?.message ?? 'Unknown'}`,
      '',
      '### Wizard State',
      `- **Structure:** ${answers.documentStructure ?? 'skipped'}`,
      `- **Date format:** ${answers.dateFormat?.format ?? 'skipped'}`,
      `- **Timezone:** ${answers.timezone ?? 'skipped'}`,
      `- **Locations:** ${answers.locations.length > 0 ? answers.locations.join(', ') : 'none'}`,
      `- **Status codes:** ${answers.statusCodes.length > 0 ? answers.statusCodes.join(', ') : 'none'}`,
      `- **Event name position:** ${answers.eventNamePosition ?? 'skipped'}`,
    ]
    if (reportNote.trim()) {
      lines.push('', '### Additional Notes', reportNote.trim())
    }
    if (includesPdf) {
      lines.push(
        '',
        '### PDF',
        '_User indicated they would like to attach the PDF. Please upload it as a comment._'
      )
    }
    return lines.join('\n')
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        {msg.title}
      </h2>
      <p className="mt-2 text-sm text-on-surface-muted">{msg.message}</p>

      {/* "What still works" note */}
      <div className="mt-4 rounded-lg border border-surface-dim bg-surface-dim/30 p-3">
        <p className="text-xs text-on-surface-muted">{msg.note}</p>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {!showReport && (
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            Report this issue
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-lg border border-surface-dim px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
        >
          Start over with new PDF
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className="rounded-lg border border-surface-dim px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
        >
          Go home
        </button>
      </div>

      {/* Bug report form */}
      {showReport && (
        <div className="mt-6 rounded-lg border border-surface-dim p-4">
          <h3 className="text-sm font-medium text-on-surface">
            Report this issue
          </h3>
          <p className="mt-1 text-xs text-on-surface-muted">
            This will open a GitHub issue so the team can investigate.
          </p>

          {/* Optional note */}
          <textarea
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="Any additional details (optional)..."
            rows={3}
            className="mt-3 w-full rounded-lg border border-surface-dim bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none"
          />

          {/* PDF attachment option */}
          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={includesPdf}
              onChange={(e) => setIncludesPdf(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <div>
              <span className="text-sm text-on-surface">
                I&apos;ll attach my PDF to the issue
              </span>
              <p className="text-xs text-on-surface-muted">
                Your file will be publicly visible on GitHub. Only check this if
                you&apos;re comfortable sharing it.
              </p>
            </div>
          </label>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowReport(false)}
              className="rounded-lg px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <a
              href={buildIssueUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity"
            >
              Submit report
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
