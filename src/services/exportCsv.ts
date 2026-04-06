import type { ParsedEvent } from './parser'

/** Which columns to include in CSV export. */
export interface CsvColumnSelection {
  name: boolean
  startDate: boolean
  endDate: boolean
  moveInDate: boolean
  moveOutDate: boolean
  location: boolean
  status: boolean
}

/** Options for CSV export generation. */
export interface CsvExportOptions {
  delimiter: ',' | '\t' | ';'
  columns: CsvColumnSelection
}

/** Column definitions mapping keys to header labels. */
const COLUMN_DEFS: { key: keyof CsvColumnSelection; header: string; field: keyof ParsedEvent }[] = [
  { key: 'name', header: 'Event Name', field: 'name' },
  { key: 'startDate', header: 'Start Date', field: 'startDate' },
  { key: 'endDate', header: 'End Date', field: 'endDate' },
  { key: 'moveInDate', header: 'Move-In Date', field: 'moveInDate' },
  { key: 'moveOutDate', header: 'Move-Out Date', field: 'moveOutDate' },
  { key: 'location', header: 'Location', field: 'location' },
  { key: 'status', header: 'Status', field: 'status' },
]

/**
 * Escape a value for CSV: wrap in quotes, escape internal quotes by doubling.
 */
function escapeField(value: string | null): string {
  const str = value ?? ''
  return '"' + str.replace(/"/g, '""') + '"'
}

/**
 * Generate CSV output from selected parsed events.
 * Includes UTF-8 BOM for Excel compatibility.
 */
export function generateCsv(events: ParsedEvent[], options: CsvExportOptions): string {
  const selected = events.filter((e) => e.isSelected)
  const activeCols = COLUMN_DEFS.filter((col) => options.columns[col.key])

  // Header row
  const header = activeCols.map((col) => escapeField(col.header)).join(options.delimiter)

  // Data rows
  const rows = selected.map((event) => {
    return activeCols
      .map((col) => escapeField(String(event[col.field] ?? '')))
      .join(options.delimiter)
  })

  // UTF-8 BOM + content
  const BOM = '\uFEFF'
  return BOM + [header, ...rows].join('\n') + '\n'
}

/** Default CSV export options. */
export const DEFAULT_CSV_OPTIONS: CsvExportOptions = {
  delimiter: ',',
  columns: {
    name: true,
    startDate: true,
    endDate: true,
    moveInDate: false,
    moveOutDate: false,
    location: true,
    status: true,
  },
}
