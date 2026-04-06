import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { parseText } from '../services/parser'
import type { ParsedEvent } from '../services/parser'

/** Column keys that can be toggled on/off. */
type ToggleableColumn = 'startDate' | 'endDate' | 'moveInDate' | 'moveOutDate' | 'status'

/** Labels for toggleable columns. */
const COLUMN_LABELS: Record<ToggleableColumn, string> = {
  startDate: 'Start',
  endDate: 'End',
  moveInDate: 'Move-In',
  moveOutDate: 'Move-Out',
  status: 'Status',
}

/** Date range filter presets. */
const DATE_RANGE_OPTIONS = [
  { label: 'All dates', value: 'all' },
  { label: 'Next 30 days', value: '30' },
  { label: 'Next 90 days', value: '90' },
  { label: 'Next 6 months', value: '180' },
  { label: 'Next year', value: '365' },
] as const

/**
 * Format an ISO date string (YYYY-MM-DD) to a short display format (M/D).
 */
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

/**
 * Check if an event falls within a date range starting from today.
 */
function isWithinDays(event: ParsedEvent, days: number): boolean {
  const date = event.startDate ?? event.endDate
  if (!date) return true // show events without dates
  // Parse ISO date parts to avoid UTC vs local timezone mismatch
  const [y, m, d] = date.split('-').map(Number)
  const eventDate = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + days)
  return eventDate >= now && eventDate <= cutoff
}

/**
 * Parsed Results screen (Screen 4).
 * Shows parsed events in a table with selection, filtering, and warning display.
 */
export function ResultsPage() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()

  // Parsing state
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [hasParsed, setHasParsed] = useState(state.parsedEvents.length > 0)

  // UI state
  const [visibleColumns, setVisibleColumns] = useState<Set<ToggleableColumn>>(
    new Set(['startDate', 'endDate', 'status'])
  )
  const [dateRange, setDateRange] = useState<string>('all')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Redirect if no PDF or template
  useEffect(() => {
    if (!state.pdfData || !state.selectedTemplate) {
      navigate('/', { replace: true })
    }
  }, [state.pdfData, state.selectedTemplate, navigate])

  // Run parser once when page loads with PDF + template
  useEffect(() => {
    if (
      state.pdfData &&
      state.selectedTemplate &&
      !hasParsed &&
      !parsing
    ) {
      setParsing(true)
      parseText(state.pdfData.text, state.selectedTemplate)
        .then((events) => {
          dispatch({ type: 'SET_PARSED_EVENTS', payload: events })
        })
        .catch((err) => {
          setParseError(
            err instanceof Error ? err.message : 'Failed to parse PDF text'
          )
        })
        .finally(() => {
          setParsing(false)
          setHasParsed(true)
        })
    }
  }, [state.pdfData, state.selectedTemplate, hasParsed, parsing, dispatch])

  // Filter events by date range
  const filteredEvents = useMemo(() => {
    if (dateRange === 'all') return state.parsedEvents
    const days = parseInt(dateRange, 10)
    return state.parsedEvents.filter((e) => isWithinDays(e, days))
  }, [state.parsedEvents, dateRange])

  // Counts
  const totalCount = state.parsedEvents.length
  const selectedCount = state.parsedEvents.filter((e) => e.isSelected).length
  const warningCount = state.parsedEvents.filter((e) => e.warnings.length > 0).length

  /** Toggle a column's visibility. */
  const toggleColumn = useCallback((col: ToggleableColumn) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(col)) {
        next.delete(col)
      } else {
        next.add(col)
      }
      return next
    })
  }, [])

  if (!state.pdfData || !state.selectedTemplate) return null

  if (parsing) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" role="status" />
        <p className="text-on-surface-muted">Parsing events...</p>
      </div>
    )
  }

  if (parseError) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="mb-2 font-heading text-2xl font-bold text-primary">Parse Error</h1>
        <p className="mb-4 text-on-surface-muted">{parseError}</p>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          onClick={() => {
            dispatch({ type: 'CLEAR_PDF_DATA' })
            dispatch({ type: 'CLEAR_TEMPLATE' })
            navigate('/')
          }}
        >
          Start Over
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-on-surface-muted">
          Template: <span className="font-medium text-on-surface">{state.selectedTemplate.name}</span>
        </p>
        <p className="text-sm text-on-surface-muted">
          {totalCount} events found{warningCount > 0 && ` \u00b7 ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-on-surface-muted/20 px-3 py-1.5 text-xs font-medium hover:bg-surface-dim"
          onClick={() => dispatch({ type: 'SELECT_ALL_EVENTS' })}
        >
          Select All
        </button>
        <button
          type="button"
          className="rounded-lg border border-on-surface-muted/20 px-3 py-1.5 text-xs font-medium hover:bg-surface-dim"
          onClick={() => dispatch({ type: 'SELECT_NONE_EVENTS' })}
        >
          Select None
        </button>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="rounded-lg border border-on-surface-muted/20 bg-surface px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
          aria-label="Date range filter"
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Column toggle pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-on-surface-muted">Show columns:</span>
        {(Object.entries(COLUMN_LABELS) as [ToggleableColumn, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              visibleColumns.has(key)
                ? 'bg-primary text-white'
                : 'bg-on-surface-muted/10 text-on-surface-muted hover:bg-on-surface-muted/20'
            }`}
            onClick={() => toggleColumn(key)}
            aria-pressed={visibleColumns.has(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-on-surface-muted/20 sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-on-surface-muted/20 bg-surface-dim">
            <tr>
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-10 px-3 py-2 text-xs font-medium text-on-surface-muted">#</th>
              <th className="px-3 py-2 text-xs font-medium text-on-surface-muted">Event Name</th>
              {visibleColumns.has('startDate') && (
                <th className="px-3 py-2 text-xs font-medium text-on-surface-muted">Start</th>
              )}
              {visibleColumns.has('endDate') && (
                <th className="px-3 py-2 text-xs font-medium text-on-surface-muted">End</th>
              )}
              {visibleColumns.has('moveInDate') && (
                <th className="px-3 py-2 text-xs font-medium text-on-surface-muted">Move-In</th>
              )}
              {visibleColumns.has('moveOutDate') && (
                <th className="px-3 py-2 text-xs font-medium text-on-surface-muted">Move-Out</th>
              )}
              {visibleColumns.has('status') && (
                <th className="px-3 py-2 text-xs font-medium text-on-surface-muted">Status</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                index={index + 1}
                visibleColumns={visibleColumns}
                isExpanded={expandedEventId === event.id}
                onToggleSelect={() => dispatch({ type: 'TOGGLE_EVENT', payload: event.id })}
                onToggleExpand={() =>
                  setExpandedEventId((prev) => (prev === event.id ? null : event.id))
                }
                onAcceptSuggestion={(warningIndex) =>
                  dispatch({
                    type: 'ACCEPT_SUGGESTION',
                    payload: { eventId: event.id, warningIndex },
                  })
                }
              />
            ))}
          </tbody>
        </table>
        {filteredEvents.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-on-surface-muted">
            No events match the current filter.
          </p>
        )}
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 sm:hidden">
        {filteredEvents.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            index={index + 1}
            visibleColumns={visibleColumns}
            isExpanded={expandedEventId === event.id}
            onToggleSelect={() => dispatch({ type: 'TOGGLE_EVENT', payload: event.id })}
            onToggleExpand={() =>
              setExpandedEventId((prev) => (prev === event.id ? null : event.id))
            }
            onAcceptSuggestion={(warningIndex) =>
              dispatch({
                type: 'ACCEPT_SUGGESTION',
                payload: { eventId: event.id, warningIndex },
              })
            }
          />
        ))}
        {filteredEvents.length === 0 && (
          <p className="py-6 text-center text-sm text-on-surface-muted">
            No events match the current filter.
          </p>
        )}
      </div>

      {/* Warning summary */}
      {warningCount > 0 && (
        <p className="mt-4 text-sm text-on-surface-muted">
          <span aria-hidden="true" className="mr-1">&#9888;</span>
          {warningCount} warning{warningCount !== 1 ? 's' : ''} &mdash; click event name for details
        </p>
      )}

      {/* Selection count and actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-on-surface-muted">
          {selectedCount} of {totalCount} events selected
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-lg border border-on-surface-muted/20 px-4 py-2 text-sm font-medium hover:bg-surface-dim"
            onClick={() => {
              dispatch({ type: 'CLEAR_PDF_DATA' })
              dispatch({ type: 'CLEAR_TEMPLATE' })
              dispatch({ type: 'SET_PARSED_EVENTS', payload: [] })
              navigate('/')
            }}
          >
            New PDF
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => navigate('/export')}
          >
            Export Selected Events
          </button>
        </div>
      </div>
    </div>
  )
}

/** Props shared by EventRow and EventCard. */
interface EventItemProps {
  event: ParsedEvent
  index: number
  visibleColumns: Set<ToggleableColumn>
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onAcceptSuggestion: (warningIndex: number) => void
}

/**
 * Desktop table row for a single parsed event.
 */
function EventRow({
  event,
  index,
  visibleColumns,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onAcceptSuggestion,
}: EventItemProps) {
  const hasWarnings = event.warnings.length > 0

  return (
    <>
      <tr className="border-b border-on-surface-muted/10 hover:bg-surface-dim/50">
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={event.isSelected}
            onChange={onToggleSelect}
            className="accent-primary"
            aria-label={`Select ${event.name}`}
          />
        </td>
        <td className="px-3 py-2 text-xs text-on-surface-muted">{index}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            className="text-left font-medium text-on-surface hover:text-primary hover:underline"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
          >
            {event.name}
            {hasWarnings && (
              <span className="ml-1 text-accent" role="img" aria-label="has warnings" title="Parse warnings">
                &#9888;
              </span>
            )}
          </button>
        </td>
        {visibleColumns.has('startDate') && (
          <td className="px-3 py-2 text-on-surface-muted">{formatDate(event.startDate)}</td>
        )}
        {visibleColumns.has('endDate') && (
          <td className="px-3 py-2 text-on-surface-muted">{formatDate(event.endDate)}</td>
        )}
        {visibleColumns.has('moveInDate') && (
          <td className="px-3 py-2 text-on-surface-muted">{formatDate(event.moveInDate)}</td>
        )}
        {visibleColumns.has('moveOutDate') && (
          <td className="px-3 py-2 text-on-surface-muted">{formatDate(event.moveOutDate)}</td>
        )}
        {visibleColumns.has('status') && (
          <td className="px-3 py-2 text-on-surface-muted">{event.status ?? ''}</td>
        )}
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={3 + visibleColumns.size} className="bg-surface-dim px-4 py-3">
            <EventDetail
              event={event}
              onAcceptSuggestion={onAcceptSuggestion}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * Mobile card layout for a single parsed event.
 */
function EventCard({
  event,
  index,
  visibleColumns,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onAcceptSuggestion,
}: EventItemProps) {
  const hasWarnings = event.warnings.length > 0

  return (
    <div className="rounded-xl border border-on-surface-muted/20 bg-surface p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={event.isSelected}
          onChange={onToggleSelect}
          className="mt-1 accent-primary"
          aria-label={`Select ${event.name}`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-muted">#{index}</span>
            <button
              type="button"
              className="text-left font-medium text-on-surface hover:text-primary hover:underline"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
            >
              {event.name}
              {hasWarnings && (
                <span className="ml-1 text-accent" aria-label="has warnings">&#9888;</span>
              )}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-muted">
            {visibleColumns.has('startDate') && event.startDate && (
              <span>Start: {formatDate(event.startDate)}</span>
            )}
            {visibleColumns.has('endDate') && event.endDate && (
              <span>End: {formatDate(event.endDate)}</span>
            )}
            {visibleColumns.has('moveInDate') && event.moveInDate && (
              <span>Move-In: {formatDate(event.moveInDate)}</span>
            )}
            {visibleColumns.has('moveOutDate') && event.moveOutDate && (
              <span>Move-Out: {formatDate(event.moveOutDate)}</span>
            )}
            {visibleColumns.has('status') && event.status && (
              <span>Status: {event.status}</span>
            )}
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="mt-3 border-t border-on-surface-muted/10 pt-3">
          <EventDetail
            event={event}
            onAcceptSuggestion={onAcceptSuggestion}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Expanded detail view for an event — shows warnings and raw PDF text.
 */
function EventDetail({
  event,
  onAcceptSuggestion,
}: {
  event: ParsedEvent
  onAcceptSuggestion: (warningIndex: number) => void
}) {
  return (
    <div className="space-y-3">
      {/* Warnings */}
      {event.warnings.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-accent">Warnings</h4>
          <ul className="space-y-2">
            {event.warnings.map((w, i) => (
              <li key={`${w.field}-${i}`} className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
                <p>
                  <span className="font-medium">Field:</span> {w.field}
                </p>
                <p>
                  <span className="font-medium">Issue:</span> {w.message}
                </p>
                {w.rawValue && (
                  <p>
                    <span className="font-medium">Raw value:</span>{' '}
                    <code className="rounded bg-on-surface-muted/10 px-1">{w.rawValue}</code>
                  </p>
                )}
                {w.suggestion && (
                  <div className="mt-1 flex items-center gap-2">
                    <p>
                      <span className="font-medium">Suggestion:</span> {w.suggestion}
                    </p>
                    <button
                      type="button"
                      className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-white hover:bg-accent/80"
                      onClick={() => onAcceptSuggestion(i)}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw text */}
      <div>
        <h4 className="mb-1 text-xs font-semibold text-on-surface-muted">Raw PDF Text</h4>
        <pre className="max-h-40 overflow-auto rounded-lg bg-on-surface-muted/5 p-3 text-xs text-on-surface-muted">
          {event.rawText}
        </pre>
      </div>
    </div>
  )
}
