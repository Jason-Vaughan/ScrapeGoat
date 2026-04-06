import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { generateIcs, DEFAULT_ICS_OPTIONS } from '../services/exportIcs'
import type { IcsExportOptions } from '../services/exportIcs'
import { generateCsv, DEFAULT_CSV_OPTIONS } from '../services/exportCsv'
import type { CsvExportOptions, CsvColumnSelection } from '../services/exportCsv'
import { generateJson, DEFAULT_JSON_OPTIONS } from '../services/exportJson'
import type { JsonExportOptions } from '../services/exportJson'
import { generateMd, DEFAULT_MD_OPTIONS } from '../services/exportMd'
import type { MdExportOptions } from '../services/exportMd'

/** Available export formats. */
type ExportFormat = 'ics' | 'csv' | 'json' | 'md'

/** Format card metadata. */
const FORMAT_CARDS: { id: ExportFormat; icon: string; label: string; description: string }[] = [
  { id: 'ics', icon: '📅', label: 'ICS', description: 'Calendar import' },
  { id: 'csv', icon: '📊', label: 'CSV', description: 'Spreadsheet import' },
  { id: 'json', icon: '{ }', label: 'JSON', description: 'Data export' },
  { id: 'md', icon: '📝', label: 'MD', description: 'Read & share' },
]

/** Common IANA timezones for the selector. */
const TIMEZONES = [
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
 * Trigger a browser file download from a string content.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Get today's date as YYYY-MM-DD for file naming.
 */
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Export page — Screen 5.
 * Lets users choose a format, configure options, preview, and download.
 */
export function ExportPage() {
  const navigate = useNavigate()
  const { state } = useAppContext()
  const selectedEvents = useMemo(
    () => state.parsedEvents.filter((e) => e.isSelected),
    [state.parsedEvents],
  )

  // Redirect if no events
  if (selectedEvents.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-on-surface-muted">No events selected for export.</p>
        <button
          className="mt-4 rounded bg-primary px-4 py-2 text-white hover:bg-red-800"
          onClick={() => navigate('/results')}
        >
          Back to Results
        </button>
      </div>
    )
  }

  return (
    <ExportPageContent
      selectedEvents={selectedEvents}
      templateName={state.selectedTemplate?.name ?? null}
    />
  )
}

/**
 * Inner export page content — separated to keep hooks below the early return.
 */
function ExportPageContent({
  selectedEvents,
  templateName,
}: {
  selectedEvents: import('../services/parser').ParsedEvent[]
  templateName: string | null
}) {
  const navigate = useNavigate()
  const [format, setFormat] = useState<ExportFormat>('ics')
  const [icsOptions, setIcsOptions] = useState<IcsExportOptions>({ ...DEFAULT_ICS_OPTIONS })
  const [csvOptions, setCsvOptions] = useState<CsvExportOptions>({
    ...DEFAULT_CSV_OPTIONS,
    columns: { ...DEFAULT_CSV_OPTIONS.columns },
  })
  const [jsonOptions, setJsonOptions] = useState<JsonExportOptions>({ ...DEFAULT_JSON_OPTIONS })
  const [mdOptions, setMdOptions] = useState<MdExportOptions>({ ...DEFAULT_MD_OPTIONS })

  /** Generate export content for the current format. */
  const generateContent = useCallback((): string => {
    switch (format) {
      case 'ics':
        return generateIcs(selectedEvents, icsOptions, templateName ?? undefined)
      case 'csv':
        return generateCsv(selectedEvents, csvOptions)
      case 'json':
        return generateJson(selectedEvents, jsonOptions, templateName, icsOptions.timezone)
      case 'md':
        return generateMd(selectedEvents, mdOptions, templateName)
    }
  }, [format, selectedEvents, icsOptions, csvOptions, jsonOptions, mdOptions, templateName])

  /** Preview — first 20 lines of generated output. */
  const preview = useMemo(() => {
    const content = generateContent()
    const lines = content.split(/\r?\n/)
    const previewLines = lines.slice(0, 20)
    if (lines.length > 20) previewLines.push('...')
    return previewLines.join('\n')
  }, [generateContent])

  /** Trigger download. */
  const handleDownload = useCallback(() => {
    const content = generateContent()
    const date = todayString()
    const mimeTypes: Record<ExportFormat, string> = {
      ics: 'text/calendar;charset=utf-8',
      csv: 'text/csv;charset=utf-8',
      json: 'application/json;charset=utf-8',
      md: 'text/markdown;charset=utf-8',
    }
    downloadFile(content, `scrapegoat-export-${date}.${format}`, mimeTypes[format])
  }, [format, generateContent])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Export {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
          </h1>
        </div>
        <button
          className="rounded border border-on-surface/20 px-3 py-1.5 text-sm hover:bg-surface-alt"
          onClick={() => navigate('/results')}
          aria-label="Back to results"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      </div>

      {/* Format cards */}
      <p className="mb-3 font-medium">Choose format:</p>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FORMAT_CARDS.map((card) => (
          <button
            key={card.id}
            onClick={() => setFormat(card.id)}
            aria-pressed={format === card.id}
            className={`rounded-lg border-2 p-4 text-center transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-primary ${
              format === card.id
                ? 'border-primary bg-primary/10'
                : 'border-on-surface/20 hover:border-on-surface/40'
            }`}
          >
            <div className="text-2xl" role="img" aria-label={card.label}>
              {card.icon}
            </div>
            <div className="mt-1 font-bold">{card.label}</div>
            <div className="text-sm text-on-surface-muted">{card.description}</div>
          </button>
        ))}
      </div>

      {/* Format-specific options */}
      <div className="mb-8 rounded-lg border border-on-surface/20 p-4">
        <h2 className="mb-4 font-heading text-lg font-bold">
          {format.toUpperCase()} Options
        </h2>

        {format === 'ics' && (
          <IcsOptionsPanel options={icsOptions} onChange={setIcsOptions} />
        )}
        {format === 'csv' && (
          <CsvOptionsPanel options={csvOptions} onChange={setCsvOptions} />
        )}
        {format === 'json' && (
          <JsonOptionsPanel options={jsonOptions} onChange={setJsonOptions} />
        )}
        {format === 'md' && (
          <MdOptionsPanel options={mdOptions} onChange={setMdOptions} />
        )}
      </div>

      {/* Preview */}
      <div className="mb-8">
        <h2 className="mb-2 font-heading text-lg font-bold">Preview</h2>
        <pre className="max-h-64 overflow-auto rounded-lg border border-on-surface/20 bg-surface-alt p-4 text-xs">
          {preview}
        </pre>
      </div>

      {/* Download button */}
      <div className="text-center">
        <button
          className="rounded-lg bg-primary px-8 py-3 text-lg font-bold text-white hover:bg-red-800"
          onClick={handleDownload}
        >
          Download {format.toUpperCase()} File
        </button>
      </div>

      {/* Template actions */}
      {templateName && (
        <div className="mt-8 border-t border-on-surface/20 pt-4 text-center text-sm text-on-surface-muted">
          Template: {templateName}
        </div>
      )}
    </div>
  )
}

/** ICS format options panel. */
function IcsOptionsPanel({
  options,
  onChange,
}: {
  options: IcsExportOptions
  onChange: (opts: IcsExportOptions) => void
}) {
  return (
    <div className="space-y-4">
      {/* Timezone */}
      <div>
        <label htmlFor="ics-timezone" className="mb-1 block text-sm font-medium">
          Timezone
        </label>
        <select
          id="ics-timezone"
          className="w-full rounded border border-on-surface/20 bg-surface p-2 text-sm"
          value={options.timezone}
          onChange={(e) => onChange({ ...options, timezone: e.target.value })}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Phase toggles */}
      <div>
        <p className="mb-2 text-sm font-medium">Date fields to include as calendar entries:</p>
        <div className="flex flex-wrap gap-2">
          {(['moveIn', 'event', 'moveOut'] as const).map((phase) => {
            const labels = { moveIn: 'Move-In', event: 'Event', moveOut: 'Move-Out' }
            const checked =
              phase === 'event' ? options.includePhases.event :
              phase === 'moveIn' ? options.includePhases.moveIn :
              options.includePhases.moveOut
            return (
              <button
                key={phase}
                aria-pressed={checked}
                className={`rounded-full border px-3 py-1 text-sm ${
                  checked
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-on-surface/20 text-on-surface-muted'
                }`}
                onClick={() =>
                  onChange({
                    ...options,
                    includePhases: { ...options.includePhases, [phase]: !checked },
                  })
                }
              >
                {labels[phase]} {checked ? '✓' : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Multi-phase checkbox */}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={options.multiPhase}
          onChange={(e) => onChange({ ...options, multiPhase: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Create separate entries for each phase
          <br />
          <span className="text-on-surface-muted">(Move-In, Event, Move-Out as individual items)</span>
        </span>
      </label>
    </div>
  )
}

/** CSV format options panel. */
function CsvOptionsPanel({
  options,
  onChange,
}: {
  options: CsvExportOptions
  onChange: (opts: CsvExportOptions) => void
}) {
  const columnKeys: { key: keyof CsvColumnSelection; label: string }[] = [
    { key: 'name', label: 'Event Name' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'moveInDate', label: 'Move-In Date' },
    { key: 'moveOutDate', label: 'Move-Out Date' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status' },
  ]

  return (
    <div className="space-y-4">
      {/* Delimiter */}
      <div>
        <label htmlFor="csv-delimiter" className="mb-1 block text-sm font-medium">
          Delimiter
        </label>
        <select
          id="csv-delimiter"
          className="rounded border border-on-surface/20 bg-surface p-2 text-sm"
          value={options.delimiter}
          onChange={(e) =>
            onChange({ ...options, delimiter: e.target.value as CsvExportOptions['delimiter'] })
          }
        >
          <option value=",">Comma (,)</option>
          <option value="&#9;">Tab</option>
          <option value=";">Semicolon (;)</option>
        </select>
      </div>

      {/* Column selection */}
      <div>
        <p className="mb-2 text-sm font-medium">Columns to include:</p>
        <div className="flex flex-wrap gap-2">
          {columnKeys.map(({ key, label }) => (
            <button
              key={key}
              aria-pressed={options.columns[key]}
              className={`rounded-full border px-3 py-1 text-sm ${
                options.columns[key]
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-on-surface/20 text-on-surface-muted'
              }`}
              onClick={() =>
                onChange({
                  ...options,
                  columns: { ...options.columns, [key]: !options.columns[key] },
                })
              }
            >
              {label} {options.columns[key] ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** JSON format options panel. */
function JsonOptionsPanel({
  options,
  onChange,
}: {
  options: JsonExportOptions
  onChange: (opts: JsonExportOptions) => void
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={options.prettyPrint}
          onChange={(e) => onChange({ ...options, prettyPrint: e.target.checked })}
        />
        Pretty print (2-space indent)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={options.includeRawText}
          onChange={(e) => onChange({ ...options, includeRawText: e.target.checked })}
        />
        Include raw PDF text per event
      </label>
    </div>
  )
}

/** Markdown format options panel. */
function MdOptionsPanel({
  options,
  onChange,
}: {
  options: MdExportOptions
  onChange: (opts: MdExportOptions) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-medium">Layout</p>
        <div className="flex gap-2">
          {(['table', 'list'] as const).map((layout) => (
            <button
              key={layout}
              aria-pressed={options.layout === layout}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${
                options.layout === layout
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-on-surface/20 text-on-surface-muted'
              }`}
              onClick={() => onChange({ ...options, layout })}
            >
              {layout}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={options.includeWarnings}
          onChange={(e) => onChange({ ...options, includeWarnings: e.target.checked })}
        />
        Include warnings
      </label>
    </div>
  )
}
