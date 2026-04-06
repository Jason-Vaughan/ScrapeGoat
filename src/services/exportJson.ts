import type { ParsedEvent } from './parser'

/** Options for JSON export generation. */
export interface JsonExportOptions {
  includeRawText: boolean
  prettyPrint: boolean
}

/** Shape of the JSON export document. */
interface JsonExportDocument {
  generator: string
  exported: string
  template: string | null
  timezone: string
  eventCount: number
  events: JsonExportEvent[]
}

/** Shape of a single event in JSON export. */
interface JsonExportEvent {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  moveInDate: string | null
  moveOutDate: string | null
  location: string | null
  status: string | null
  customFields: Record<string, string>
  warnings: { field: string; message: string }[]
  rawText?: string
}

/**
 * Generate JSON output from selected parsed events.
 * Matches the spec's export schema with null fields preserved.
 */
export function generateJson(
  events: ParsedEvent[],
  options: JsonExportOptions,
  templateName?: string | null,
  timezone?: string,
): string {
  const selected = events.filter((e) => e.isSelected)

  const exportEvents: JsonExportEvent[] = selected.map((event) => {
    const entry: JsonExportEvent = {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      moveInDate: event.moveInDate,
      moveOutDate: event.moveOutDate,
      location: event.location,
      status: event.status,
      customFields: event.customFields,
      warnings: event.warnings.map((w) => ({ field: w.field, message: w.message })),
    }
    if (options.includeRawText) {
      entry.rawText = event.rawText
    }
    return entry
  })

  const doc: JsonExportDocument = {
    generator: 'ScrapeGoat v1.0',
    exported: new Date().toISOString(),
    template: templateName ?? null,
    timezone: timezone ?? 'UTC',
    eventCount: exportEvents.length,
    events: exportEvents,
  }

  if (options.prettyPrint) {
    return JSON.stringify(doc, null, 2) + '\n'
  }
  return JSON.stringify(doc) + '\n'
}

/** Default JSON export options. */
export const DEFAULT_JSON_OPTIONS: JsonExportOptions = {
  includeRawText: false,
  prettyPrint: true,
}
