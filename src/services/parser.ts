import type { ProfileTemplate } from '../schemas/templateSchema'
import { PAGE_BREAK_MARKER } from './pdfExtractor'

/** Warning generated during parsing when a field is missing or ambiguous. */
export interface ParseWarning {
  field: string
  message: string
  rawValue: string
  suggestion: string | null
}

/** A single event extracted from PDF text by the parser engine. */
export interface ParsedEvent {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  moveInDate: string | null
  moveOutDate: string | null
  location: string | null
  status: string | null
  customFields: Record<string, string>
  rawText: string
  warnings: ParseWarning[]
  isSelected: boolean
}

/**
 * Simple string hash fallback when crypto.subtle is unavailable.
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Generate a stable ID for an event using SHA-256 hash of name + startDate + location.
 * Falls back to a simple string hash if crypto.subtle is unavailable.
 */
export async function generateEventId(
  name: string,
  startDate: string | null,
  location: string | null
): Promise<string> {
  const input = `${name}|${startDate ?? ''}|${location ?? ''}`
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return simpleHash(input)
  }
}

/**
 * Check if a date (year, month, day) is valid using Date object.
 */
function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/**
 * Safely compile and execute a regex with error handling.
 * Returns null if the regex is invalid or throws during execution.
 */
function safeRegex(pattern: string, flags?: string): RegExp | null {
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}

/**
 * Strip page break markers from text so events spanning pages are treated as continuous.
 */
function stripPageBreaks(text: string): string {
  return text.split(PAGE_BREAK_MARKER).join('\n')
}

/**
 * Extract dates from a text block using template date format patterns.
 * Returns an object mapping field names to ISO date strings.
 */
function extractDates(
  text: string,
  dateFormats: ProfileTemplate['dateFormats']
): {
  dates: Record<string, string>
  warnings: ParseWarning[]
} {
  const dates: Record<string, string> = {}
  const warnings: ParseWarning[] = []

  for (const fmt of dateFormats) {
    const regex = safeRegex(fmt.pattern, 'g')
    if (!regex) continue
    const matches = Array.from(text.matchAll(regex))

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const groups = match.groups
      if (!groups) continue

      const month = parseInt(groups.month, 10)
      const day = parseInt(groups.day, 10)
      const yearRaw = groups.year
      let year = parseInt(yearRaw, 10)

      // Handle 2-digit years
      if (year < 100) {
        year += 2000
      }

      // Check for date ambiguity (month/day could be swapped)
      if (month <= 12 && day <= 12 && month !== day) {
        warnings.push({
          field: 'date',
          message: `Ambiguous date: ${match[0]} could be ${month}/${day}/${year} or ${day}/${month}/${year}`,
          rawValue: match[0],
          suggestion: null,
        })
      }

      // Validate date components (including per-month day limits)
      if (!isValidDate(year, month, day)) {
        warnings.push({
          field: 'date',
          message: `Invalid date: ${match[0]} (${month}/${day}/${year} does not exist)`,
          rawValue: match[0],
          suggestion: null,
        })
        continue
      }

      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      // Map this match to the appropriate field(s)
      if (fmt.fields.length === 1) {
        // Single field — if multiple matches, assign sequentially to startDate then endDate
        const fieldName = fmt.fields[0]
        if (fieldName === 'singleDate') {
          if (!dates.startDate) dates.startDate = isoDate
          if (!dates.endDate) dates.endDate = isoDate
        } else {
          dates[fieldName] = isoDate
        }
      } else {
        // Multiple fields — assign by match index
        if (i < fmt.fields.length) {
          const fieldName = fmt.fields[i]
          if (fieldName === 'singleDate') {
            if (!dates.startDate) dates.startDate = isoDate
            if (!dates.endDate) dates.endDate = isoDate
          } else {
            dates[fieldName] = isoDate
          }
        }
      }
    }
  }

  // If only one date found and we have startDate but no endDate, copy it
  if (dates.startDate && !dates.endDate) {
    dates.endDate = dates.startDate
  }

  return { dates, warnings }
}

/**
 * Extract the event name from a text block based on the template's eventName config.
 */
function extractEventName(
  text: string,
  fields: ProfileTemplate['fields'],
  dateFormats: ProfileTemplate['dateFormats']
): string {
  const config = fields.eventName
  const lines = text.split('\n').filter((l) => l.trim())

  if (!config || !config.position) {
    // Default: first non-empty line
    return lines[0]?.trim() ?? ''
  }

  switch (config.position) {
    case 'first_line':
      return lines[0]?.trim() ?? ''

    case 'after_date': {
      for (let i = 0; i < lines.length; i++) {
        const hasDate = dateFormats.some((fmt) => {
          const r = safeRegex(fmt.pattern)
          return r ? r.test(lines[i]) : false
        })
        if (hasDate && i + 1 < lines.length) {
          return lines[i + 1].trim()
        }
      }
      return lines[0]?.trim() ?? ''
    }

    case 'before_date': {
      for (let i = 0; i < lines.length; i++) {
        const hasDate = dateFormats.some((fmt) => {
          const r = safeRegex(fmt.pattern)
          return r ? r.test(lines[i]) : false
        })
        if (hasDate && i > 0) {
          return lines[i - 1].trim()
        }
      }
      return lines[0]?.trim() ?? ''
    }

    case 'regex': {
      if (config.pattern) {
        const r = safeRegex(config.pattern)
        const match = r ? text.match(r) : null
        if (match) {
          return (match[1] ?? match[0]).trim()
        }
      }
      return lines[0]?.trim() ?? ''
    }

    default:
      return lines[0]?.trim() ?? ''
  }
}

/**
 * Extract a field value by checking known values first, then falling back to a regex pattern.
 */
function extractByKnownOrPattern(
  text: string,
  config: { knownValues?: string[]; pattern?: string } | undefined
): string | null {
  if (!config) return null

  if (config.knownValues && config.knownValues.length > 0) {
    const textLower = text.toLowerCase()
    for (const value of config.knownValues) {
      if (textLower.includes(value.toLowerCase())) {
        return value
      }
    }
  }

  if (config.pattern) {
    const r = safeRegex(config.pattern)
    const match = r ? text.match(r) : null
    if (match) {
      return (match[1] ?? match[0]).trim()
    }
  }

  return null
}

/**
 * Extract custom fields from a text block using their regex patterns.
 */
function extractCustomFields(
  text: string,
  customFields: ProfileTemplate['customFields']
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!customFields) return result

  for (const field of customFields) {
    const r = safeRegex(field.pattern)
    const match = r ? text.match(r) : null
    if (match) {
      result[field.name] = (match[1] ?? match[0]).trim()
    }
  }

  return result
}

/**
 * Parse text using block-based structure.
 * Splits by blockDelimiter regex, then extracts fields from each block.
 */
async function parseBlock(
  text: string,
  template: ProfileTemplate
): Promise<ParsedEvent[]> {
  const delimiter = template.structure.blockDelimiter
  if (!delimiter) return []

  const delimiterRegex = safeRegex(delimiter, 'gm')
  if (!delimiterRegex) return []

  const matches: { index: number; length: number }[] = []
  let match: RegExpExecArray | null

  while ((match = delimiterRegex.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length })
    // Guard against zero-length matches causing infinite loops
    if (match[0].length === 0) delimiterRegex.lastIndex++
  }

  if (matches.length === 0) return []

  const blocks: string[] = []
  for (let i = 0; i < matches.length; i++) {
    // Start after the delimiter match itself
    const start = matches[i].index + matches[i].length
    const end =
      i + 1 < matches.length ? matches[i + 1].index : text.length
    const block = text.slice(start, end).trim()
    if (block) blocks.push(block)
  }

  const events: ParsedEvent[] = []

  for (const block of blocks) {
    const name = extractEventName(block, template.fields, template.dateFormats)
    const { dates, warnings } = extractDates(block, template.dateFormats)
    const location = extractByKnownOrPattern(block, template.fields.location)
    const status = extractByKnownOrPattern(block, template.fields.status)
    const customFields = extractCustomFields(block, template.customFields)

    if (!name) {
      warnings.push({
        field: 'name',
        message: 'Could not extract event name',
        rawValue: block.substring(0, 100),
        suggestion: null,
      })
    }

    if (!dates.startDate) {
      warnings.push({
        field: 'startDate',
        message: 'No start date found',
        rawValue: block.substring(0, 100),
        suggestion: null,
      })
    }

    const id = await generateEventId(name, dates.startDate ?? null, location)

    events.push({
      id,
      name,
      startDate: dates.startDate ?? null,
      endDate: dates.endDate ?? null,
      moveInDate: dates.moveInDate ?? null,
      moveOutDate: dates.moveOutDate ?? null,
      location,
      status,
      customFields,
      rawText: block,
      warnings,
      isSelected: true,
    })
  }

  return events
}

/**
 * Parse text using table-based structure.
 * Detects header row, determines column positions, maps columns to fields.
 */
async function parseTable(
  text: string,
  template: ProfileTemplate
): Promise<ParsedEvent[]> {
  const headers = template.structure.tableHeaders
  if (!headers || headers.length === 0) return []

  const lines = text.split('\n')

  // Find the header row
  let headerLineIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const matchCount = headers.filter((h) =>
      line.toLowerCase().includes(h.toLowerCase())
    ).length
    if (matchCount >= Math.ceil(headers.length / 2)) {
      headerLineIndex = i
      break
    }
  }

  if (headerLineIndex === -1) return []

  const headerLine = lines[headerLineIndex]

  // Determine column positions from header alignment
  const columnPositions: { name: string; start: number; end: number }[] = []
  for (const header of headers) {
    const idx = headerLine.toLowerCase().indexOf(header.toLowerCase())
    if (idx !== -1) {
      columnPositions.push({ name: header, start: idx, end: -1 })
    }
  }

  // Sort by position and compute end positions
  columnPositions.sort((a, b) => a.start - b.start)
  for (let i = 0; i < columnPositions.length; i++) {
    columnPositions[i].end =
      i + 1 < columnPositions.length
        ? columnPositions[i + 1].start
        : Infinity
  }

  const events: ParsedEvent[] = []

  // Parse data rows
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const columns: Record<string, string> = {}
    for (const col of columnPositions) {
      const value = line.substring(col.start, col.end === Infinity ? undefined : col.end).trim()
      columns[col.name] = value
    }

    // Reconstruct text for date extraction
    const rowText = Object.values(columns).join(' ')
    const { dates, warnings } = extractDates(rowText, template.dateFormats)

    // Try to find event name from columns
    const nameHeaders = ['event', 'event name', 'name', 'title', 'description']
    let name = ''
    for (const nh of nameHeaders) {
      for (const [key, val] of Object.entries(columns)) {
        if (key.toLowerCase().includes(nh) && val) {
          name = val
          break
        }
      }
      if (name) break
    }

    // Fall back to eventName field config
    if (!name && template.fields.eventName?.pattern) {
      const r = safeRegex(template.fields.eventName.pattern)
      const match = r ? rowText.match(r) : null
      if (match) name = (match[1] ?? match[0]).trim()
    }

    if (!name) {
      // Use the longest column value as a heuristic
      name = Object.values(columns).reduce(
        (a, b) => (b.length > a.length ? b : a),
        ''
      )
    }

    const location = extractByKnownOrPattern(rowText, template.fields.location)
    const status = extractByKnownOrPattern(rowText, template.fields.status)
    const customFields = extractCustomFields(rowText, template.customFields)

    if (!name) {
      warnings.push({
        field: 'name',
        message: 'Could not extract event name from table row',
        rawValue: line.substring(0, 100),
        suggestion: null,
      })
    }

    if (!dates.startDate) {
      warnings.push({
        field: 'startDate',
        message: 'No start date found in table row',
        rawValue: line.substring(0, 100),
        suggestion: null,
      })
    }

    const id = await generateEventId(name, dates.startDate ?? null, location)

    events.push({
      id,
      name,
      startDate: dates.startDate ?? null,
      endDate: dates.endDate ?? null,
      moveInDate: dates.moveInDate ?? null,
      moveOutDate: dates.moveOutDate ?? null,
      location,
      status,
      customFields,
      rawText: line,
      warnings,
      isSelected: true,
    })
  }

  return events
}

/**
 * Parse text using list-based structure.
 * Applies linePattern regex to each line; named capture groups map to fields.
 */
async function parseList(
  text: string,
  template: ProfileTemplate
): Promise<ParsedEvent[]> {
  const linePattern = template.structure.linePattern
  if (!linePattern) return []

  const regex = safeRegex(linePattern)
  if (!regex) return []

  const lines = text.split('\n')
  const events: ParsedEvent[] = []
  const skippedLines: string[] = []

  for (const line of lines) {
    if (!line.trim()) continue

    const match = line.match(regex)
    if (!match) {
      skippedLines.push(line)
      continue
    }

    const groups = match.groups ?? {}

    // Extract name from capture group or fields config
    let name = groups.name ?? groups.eventName ?? groups.title ?? ''
    if (!name && template.fields.eventName?.pattern) {
      const r = safeRegex(template.fields.eventName.pattern)
      const nameMatch = r ? line.match(r) : null
      if (nameMatch) name = (nameMatch[1] ?? nameMatch[0]).trim()
    }

    // Extract dates
    const { dates, warnings } = extractDates(line, template.dateFormats)

    // Also pick up dates from capture groups directly
    if (groups.startDate && !dates.startDate) dates.startDate = groups.startDate
    if (groups.endDate && !dates.endDate) dates.endDate = groups.endDate
    if (groups.moveInDate && !dates.moveInDate)
      dates.moveInDate = groups.moveInDate
    if (groups.moveOutDate && !dates.moveOutDate)
      dates.moveOutDate = groups.moveOutDate

    const location =
      groups.location ??
      extractByKnownOrPattern(line, template.fields.location)
    const status =
      groups.status ?? extractByKnownOrPattern(line, template.fields.status)
    const customFields = extractCustomFields(line, template.customFields)

    if (!name) {
      warnings.push({
        field: 'name',
        message: 'Could not extract event name from list line',
        rawValue: line.substring(0, 100),
        suggestion: null,
      })
    }

    const id = await generateEventId(name, dates.startDate ?? null, location)

    events.push({
      id,
      name,
      startDate: dates.startDate ?? null,
      endDate: dates.endDate ?? null,
      moveInDate: dates.moveInDate ?? null,
      moveOutDate: dates.moveOutDate ?? null,
      location,
      status,
      customFields,
      rawText: line,
      warnings,
      isSelected: true,
    })
  }

  // Add skipped-line warnings to the first event
  if (skippedLines.length > 0 && events.length > 0) {
    events[0].warnings.push({
      field: 'parsing',
      message: `${skippedLines.length} line(s) did not match the line pattern and were skipped`,
      rawValue: skippedLines.slice(0, 3).join(' | '),
      suggestion: null,
    })
  }

  return events
}

/**
 * Deduplicate events by ID, keeping the first occurrence.
 */
function deduplicateEvents(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>()
  return events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

/**
 * Sort events by startDate ascending. Events without startDate go to the end.
 */
function sortByStartDate(events: ParsedEvent[]): ParsedEvent[] {
  return [...events].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return a.startDate.localeCompare(b.startDate)
  })
}

/**
 * Validate date logic and add warnings for violations.
 * Rule: moveInDate ≤ startDate ≤ endDate ≤ moveOutDate
 */
function validateDateLogic(events: ParsedEvent[]): ParsedEvent[] {
  return events.map((event) => {
    const warnings = [...event.warnings]
    const { moveInDate, startDate, endDate, moveOutDate } = event

    if (moveInDate && startDate && moveInDate > startDate) {
      warnings.push({
        field: 'moveInDate',
        message: `Move-in date (${moveInDate}) is after start date (${startDate})`,
        rawValue: moveInDate,
        suggestion: startDate,
      })
    }

    if (startDate && endDate && startDate > endDate) {
      warnings.push({
        field: 'endDate',
        message: `Start date (${startDate}) is after end date (${endDate})`,
        rawValue: endDate,
        suggestion: startDate,
      })
    }

    if (endDate && moveOutDate && endDate > moveOutDate) {
      warnings.push({
        field: 'moveOutDate',
        message: `End date (${endDate}) is after move-out date (${moveOutDate})`,
        rawValue: moveOutDate,
        suggestion: endDate,
      })
    }

    return { ...event, warnings }
  })
}

/**
 * Post-process parsed events: deduplicate, sort, validate dates.
 */
function postProcess(events: ParsedEvent[]): ParsedEvent[] {
  let result = deduplicateEvents(events)
  result = sortByStartDate(result)
  result = validateDateLogic(result)
  return result
}

/**
 * Main parser entry point.
 * Takes extracted PDF text and a template profile, returns parsed events.
 */
export async function parseText(
  text: string,
  template: ProfileTemplate
): Promise<ParsedEvent[]> {
  const cleanText = stripPageBreaks(text)

  let events: ParsedEvent[]

  switch (template.structure.type) {
    case 'block':
      events = await parseBlock(cleanText, template)
      break
    case 'table':
      events = await parseTable(cleanText, template)
      break
    case 'list':
      events = await parseList(cleanText, template)
      break
    default:
      return []
  }

  return postProcess(events)
}

// Export internals for testing
export {
  stripPageBreaks,
  extractDates,
  extractEventName,
  extractByKnownOrPattern,
  extractCustomFields,
  deduplicateEvents,
  sortByStartDate,
  validateDateLogic,
  postProcess,
  isValidDate,
  safeRegex,
}
