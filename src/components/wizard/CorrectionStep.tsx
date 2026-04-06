import { useState, useEffect, useCallback } from 'react'
import { getCorrectionSuggestions } from '../../services/aiService'
import type { ParsedEvent } from '../../services/parser'
import type { FlaggedEvent, CorrectionAlternative } from '../../hooks/useWizardReducer'
import { MAX_CORRECTION_ROUNDS } from '../../hooks/useWizardReducer'

/** Field options for "what's wrong" checkboxes. */
const ISSUE_FIELDS = [
  { value: 'name', label: 'Event name' },
  { value: 'dates', label: 'Dates' },
  { value: 'location', label: 'Location' },
  { value: 'status', label: 'Status' },
]

interface CorrectionStepProps {
  flaggedEvents: FlaggedEvent[]
  currentIndex: number
  testResults: ParsedEvent[]
  turnstileToken: string | null
  onResetTurnstile: () => void
  onSetCorrections: (eventId: string, corrections: CorrectionAlternative[]) => void
  onResolve: (eventId: string) => void
  onAdvance: () => void
}

/**
 * Screen 3h: Correction flow.
 * For each flagged event: user selects what's wrong, then picks from AI alternatives.
 */
export function CorrectionStep({
  flaggedEvents,
  currentIndex,
  testResults,
  turnstileToken,
  onResetTurnstile,
  onSetCorrections,
  onResolve,
  onAdvance,
}: CorrectionStepProps) {
  const flagged = flaggedEvents[currentIndex]
  if (!flagged) return null

  const event = testResults.find((e) => e.id === flagged.eventId)
  const exhausted = flagged.correctionRound >= MAX_CORRECTION_ROUNDS

  if (exhausted) {
    return (
      <ExhaustedView
        eventName={event?.name ?? '(unnamed)'}
        onSkip={() => {
          onResolve(flagged.eventId)
          onAdvance()
        }}
      />
    )
  }

  return (
    <CorrectionFlow
      flagged={flagged}
      event={event}
      turnstileToken={turnstileToken}
      onResetTurnstile={onResetTurnstile}
      onSetCorrections={onSetCorrections}
      onResolve={onResolve}
      onAdvance={onAdvance}
    />
  )
}

interface CorrectionFlowProps {
  flagged: FlaggedEvent
  event: ParsedEvent | undefined
  turnstileToken: string | null
  onResetTurnstile: () => void
  onSetCorrections: (eventId: string, corrections: CorrectionAlternative[]) => void
  onResolve: (eventId: string) => void
  onAdvance: () => void
}

/**
 * Inner component handling the two sub-steps: what's wrong → pick alternatives.
 */
function CorrectionFlow({
  flagged,
  event,
  turnstileToken,
  onResetTurnstile,
  onSetCorrections,
  onResolve,
  onAdvance,
}: CorrectionFlowProps) {
  const [phase, setPhase] = useState<'issues' | 'alternatives'>('issues')
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [selectedAlts, setSelectedAlts] = useState<Record<string, string>>({})

  /** Reset state when flagged event changes. */
  useEffect(() => {
    setPhase('issues')
    setSelectedIssues([])
    setSelectedAlts({})
    setFetchError(false)
  }, [flagged.eventId])

  /** Toggle an issue field. */
  function toggleIssue(field: string) {
    setSelectedIssues((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    )
  }

  /** Fetch correction suggestions from AI. */
  const fetchAlternatives = useCallback(async () => {
    setLoading(true)
    try {
      const corrections = await getCorrectionSuggestions(
        event?.rawText ?? '',
        selectedIssues,
        turnstileToken || ''
      )
      onSetCorrections(flagged.eventId, corrections)
      setPhase('alternatives')
      // Reset Turnstile for next correction request
      onResetTurnstile()
    } catch {
      // Show error briefly, then resolve and skip
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [event, selectedIssues, flagged.eventId, turnstileToken, onResetTurnstile, onSetCorrections, onResolve, onAdvance])

  /** Apply selected alternatives and advance. */
  function handleApply() {
    onResolve(flagged.eventId)
    onAdvance()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16" role="status">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-surface-dim border-t-primary" />
        <p className="text-on-surface-muted">Finding alternatives...</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="py-8 text-center">
        <p className="text-on-surface">
          Couldn&apos;t get alternatives for this event.
        </p>
        <p className="mt-2 text-sm text-on-surface-muted">
          The AI service didn&apos;t respond. This event will be skipped.
        </p>
        <button
          type="button"
          onClick={() => {
            onResolve(flagged.eventId)
            onAdvance()
          }}
          className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Fix: {event?.name || '(unnamed event)'}
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        Correction round {flagged.correctionRound + 1} of {MAX_CORRECTION_ROUNDS}
      </p>

      {/* Raw text preview */}
      {event?.rawText && (
        <pre className="mt-4 max-h-32 overflow-y-auto rounded-lg bg-surface-dim p-3 text-xs text-on-surface-muted">
          {event.rawText}
        </pre>
      )}

      {phase === 'issues' ? (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-on-surface">
            What&apos;s wrong with this event?
          </h3>
          <div className="mt-3 space-y-2" role="group" aria-label="Issue fields">
            {ISSUE_FIELDS.map((field) => (
              <label
                key={field.value}
                className={`flex cursor-pointer items-center rounded-lg border px-4 py-3 transition-colors ${
                  selectedIssues.includes(field.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-dim hover:border-on-surface-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIssues.includes(field.value)}
                  onChange={() => toggleIssue(field.value)}
                  className="shrink-0 accent-primary"
                />
                <span className="ml-3 text-sm text-on-surface">
                  {field.label}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                onResolve(flagged.eventId)
                onAdvance()
              }}
              className="rounded-lg px-4 py-2 text-sm text-on-surface-muted hover:text-on-surface transition-colors"
            >
              Skip this event
            </button>
            <button
              type="button"
              onClick={fetchAlternatives}
              disabled={selectedIssues.length === 0}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              Find alternatives
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-on-surface">
            Pick the correct values:
          </h3>
          <div className="mt-3 space-y-4">
            {flagged.corrections.map((correction) => (
              <div key={correction.field}>
                <span className="text-xs font-medium uppercase text-on-surface-muted">
                  {correction.field}
                </span>
                <div
                  className="mt-2 space-y-2"
                  role="radiogroup"
                  aria-label={`Alternatives for ${correction.field}`}
                >
                  {correction.alternatives.map((alt) => (
                    <label
                      key={alt.value}
                      className={`flex cursor-pointer items-center rounded-lg border px-4 py-3 transition-colors ${
                        selectedAlts[correction.field] === alt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-surface-dim hover:border-on-surface-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`alt-${correction.field}`}
                        value={alt.value}
                        checked={selectedAlts[correction.field] === alt.value}
                        onChange={() =>
                          setSelectedAlts((prev) => ({
                            ...prev,
                            [correction.field]: alt.value,
                          }))
                        }
                        className="shrink-0 accent-primary"
                      />
                      <span className="ml-3 text-sm text-on-surface">
                        {alt.label}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex cursor-pointer items-center rounded-lg border px-4 py-3 transition-colors ${
                      selectedAlts[correction.field] === '__skip__'
                        ? 'border-primary bg-primary/5'
                        : 'border-surface-dim hover:border-on-surface-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`alt-${correction.field}`}
                      value="__skip__"
                      checked={selectedAlts[correction.field] === '__skip__'}
                      onChange={() =>
                        setSelectedAlts((prev) => ({
                          ...prev,
                          [correction.field]: '__skip__',
                        }))
                      }
                      className="shrink-0 accent-primary"
                    />
                    <span className="ml-3 text-sm text-on-surface-muted">
                      None of these (skip)
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-opacity"
            >
              Apply fix
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ExhaustedViewProps {
  eventName: string
  onSkip: () => void
}

/**
 * Shown when correction rounds are exhausted for an event.
 */
function ExhaustedView({ eventName, onSkip }: ExhaustedViewProps) {
  return (
    <div className="py-8 text-center">
      <p className="text-lg text-on-surface">
        We&apos;ve tried our best with &ldquo;{eventName}&rdquo;
      </p>
      <p className="mt-2 text-sm text-on-surface-muted">
        After {MAX_CORRECTION_ROUNDS} attempts, we couldn&apos;t get a perfect
        match. The current best result will be used.
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="mt-6 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white"
      >
        Continue
      </button>
    </div>
  )
}
