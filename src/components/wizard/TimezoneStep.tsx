import { useMemo, useState } from 'react'
import type { AiAnalysis } from '../../hooks/useWizardReducer'

interface TimezoneStepProps {
  analysis: AiAnalysis
  selected: string | null
  onSelect: (value: string) => void
}

/** Common IANA timezones for quick selection. */
const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
]

/**
 * Get the full list of IANA timezones.
 * Uses Intl API when available, falls back to common list.
 */
function getAllTimezones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return (Intl as unknown as { supportedValuesOf: (key: string) => string[] })
        .supportedValuesOf('timeZone')
    }
  } catch {
    // Fallback
  }
  return COMMON_TIMEZONES
}

/**
 * Screen 3c: Timezone selection.
 * Shows AI-detected timezone, common options, and a searchable IANA list.
 */
export function TimezoneStep({
  analysis,
  selected,
  onSelect,
}: TimezoneStepProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const allTimezones = useMemo(getAllTimezones, [])

  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )

  const filteredTimezones = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allTimezones
      .filter((tz) => tz.toLowerCase().includes(q))
      .slice(0, 20)
  }, [searchQuery, allTimezones])

  /** Deduplicated quick-pick options (AI-detected, browser, common). */
  const quickPicks = useMemo(() => {
    const picks: string[] = []
    if (analysis.detectedTimezone) picks.push(analysis.detectedTimezone)
    if (browserTimezone && !picks.includes(browserTimezone)) {
      picks.push(browserTimezone)
    }
    for (const tz of COMMON_TIMEZONES) {
      if (!picks.includes(tz)) picks.push(tz)
    }
    return picks
  }, [analysis.detectedTimezone, browserTimezone])

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold text-on-surface">
        What timezone are these events in?
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        This determines how dates are written in exports.
      </p>

      {/* AI-detected badge */}
      {analysis.detectedTimezone && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <span className="text-xs font-medium text-primary">AI Detected</span>
          <p className="mt-1 text-sm text-on-surface">
            {analysis.detectedTimezone}
          </p>
        </div>
      )}

      {/* Quick picks */}
      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Timezone">
        {quickPicks.map((tz) => (
          <label
            key={tz}
            className={`flex cursor-pointer items-center rounded-lg border px-4 py-3 transition-colors ${
              selected === tz
                ? 'border-primary bg-primary/5'
                : 'border-surface-dim hover:border-on-surface-muted'
            }`}
          >
            <input
              type="radio"
              name="timezone"
              value={tz}
              checked={selected === tz}
              onChange={() => onSelect(tz)}
              className="shrink-0 accent-primary"
            />
            <span className="ml-3 text-sm text-on-surface">{formatTimezone(tz)}</span>
            {tz === analysis.detectedTimezone && (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                detected
              </span>
            )}
            {tz === browserTimezone && tz !== analysis.detectedTimezone && (
              <span className="ml-auto rounded-full bg-surface-dim px-2 py-0.5 text-xs text-on-surface-muted">
                your browser
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search all timezones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-surface-dim bg-surface px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none"
          aria-label="Search timezones"
        />
        {filteredTimezones.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-surface-dim">
            {filteredTimezones.map((tz) => (
              <button
                key={tz}
                type="button"
                onClick={() => {
                  onSelect(tz)
                  setSearchQuery('')
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-dim ${
                  selected === tz ? 'bg-primary/5 text-primary' : 'text-on-surface'
                }`}
              >
                {formatTimezone(tz)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Format an IANA timezone string for display.
 * Converts "America/New_York" to "America / New York".
 */
function formatTimezone(tz: string): string {
  return tz.replace(/_/g, ' ').replace(/\//g, ' / ')
}
