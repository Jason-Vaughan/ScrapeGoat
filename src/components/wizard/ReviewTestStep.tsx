import { useCallback, useEffect, useState } from 'react'
import type { ParsedEvent } from '../../services/parser'
import { parseText } from '../../services/parser'
import { buildTemplate } from '../../services/templateBuilder'
import type { AiAnalysis, WizardAnswers, FlaggedEvent } from '../../hooks/useWizardReducer'

interface ReviewTestStepProps {
  pdfText: string
  answers: WizardAnswers
  analysis: AiAnalysis
  testResults: ParsedEvent[]
  onTestResults: (events: ParsedEvent[]) => void
  onLooksGood: () => void
  onFixFlagged: (flagged: FlaggedEvent[]) => void
  onFailure: () => void
}

/**
 * Screen 3g: Review & Test Parse.
 * Runs a test parse with the current template, shows results with pass/fail per event.
 * User can flag incorrect events for correction or accept results.
 */
export function ReviewTestStep({
  pdfText,
  answers,
  analysis,
  testResults,
  onTestResults,
  onLooksGood,
  onFixFlagged,
  onFailure,
}: ReviewTestStepProps) {
  const [parsing, setParsing] = useState(false)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())

  /** Run the test parse on mount and when answers change. */
  const runParse = useCallback(async () => {
    setParsing(true)
    try {
      const template = buildTemplate('Test', answers, analysis)
      const events = await parseText(pdfText, template)
      onTestResults(events)
      if (events.length === 0) {
        onFailure()
      }
    } catch {
      onFailure()
    } finally {
      setParsing(false)
    }
  }, [pdfText, answers, analysis, onTestResults, onFailure])

  useEffect(() => {
    runParse()
  }, [runParse])

  /** Toggle an event's flagged status. */
  function toggleFlag(eventId: string) {
    setFlaggedIds((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }

  /** Proceed with flagged events to correction. */
  function handleFixFlagged() {
    const flagged: FlaggedEvent[] = testResults
      .filter((e) => flaggedIds.has(e.id))
      .map((e) => ({
        eventId: e.id,
        issues: [],
        correctionRound: 0,
        resolved: false,
        corrections: [],
      }))
    onFixFlagged(flagged)
  }

  const correctCount = testResults.filter(
    (e) => e.warnings.length === 0 && !flaggedIds.has(e.id)
  ).length
  const flaggedCount = flaggedIds.size

  if (parsing) {
    return (
      <div className="flex flex-col items-center py-16" role="status">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-surface-dim border-t-primary" />
        <p className="text-on-surface-muted">Running test parse...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        Review parsed results
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        We parsed {testResults.length} event{testResults.length !== 1 ? 's' : ''}.
        {analysis.estimatedEventCount > 0 && (
          <span>
            {' '}
            (expected ~{analysis.estimatedEventCount})
          </span>
        )}
      </p>

      {/* Summary */}
      <div className="mt-4 flex gap-4 text-sm">
        <span className="text-green-600 dark:text-green-400">
          {correctCount} correct
        </span>
        {flaggedCount > 0 && (
          <span className="text-red-600 dark:text-red-400">
            {flaggedCount} flagged
          </span>
        )}
      </div>

      {/* Event table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-surface-dim">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-dim bg-surface-dim/50">
              <th className="px-4 py-2 text-left font-medium text-on-surface-muted">
                Event Name
              </th>
              <th className="px-4 py-2 text-left font-medium text-on-surface-muted">
                Dates
              </th>
              <th className="px-4 py-2 text-left font-medium text-on-surface-muted">
                Location
              </th>
              <th className="px-4 py-2 text-center font-medium text-on-surface-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {testResults.map((event) => {
              const hasWarnings = event.warnings.length > 0
              const isFlagged = flaggedIds.has(event.id)

              return (
                <tr
                  key={event.id}
                  className={`border-b border-surface-dim last:border-b-0 ${
                    isFlagged ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-on-surface">
                    {event.name || '(unnamed)'}
                  </td>
                  <td className="px-4 py-2 text-on-surface-muted">
                    {event.startDate || '—'}
                  </td>
                  <td className="px-4 py-2 text-on-surface-muted">
                    {event.location || '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleFlag(event.id)}
                      className="text-lg"
                      title={isFlagged ? 'Unflag this event' : 'Flag this event'}
                      aria-label={
                        isFlagged
                          ? `Unflag ${event.name}`
                          : `Flag ${event.name}`
                      }
                    >
                      {isFlagged ? (
                        <span className="text-red-500" aria-hidden="true">&#10008;</span>
                      ) : hasWarnings ? (
                        <span className="text-yellow-500" aria-hidden="true">&#9888;</span>
                      ) : (
                        <span className="text-green-500" aria-hidden="true">&#10004;</span>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex justify-end gap-3">
        {flaggedCount > 0 && (
          <button
            type="button"
            onClick={handleFixFlagged}
            className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            Fix {flaggedCount} flagged event{flaggedCount !== 1 ? 's' : ''}
          </button>
        )}
        <button
          type="button"
          onClick={onLooksGood}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-opacity"
        >
          Looks good
        </button>
      </div>
    </div>
  )
}
