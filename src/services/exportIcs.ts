import type { ParsedEvent } from './parser'

/** Options for ICS export generation. */
export interface IcsExportOptions {
  timezone: string
  includePhases: {
    moveIn: boolean
    event: boolean
    moveOut: boolean
  }
  multiPhase: boolean
}

/** Standard VTIMEZONE definitions for common US timezones. */
const TIMEZONE_RULES: Record<string, { standard: VTimezoneRule; daylight: VTimezoneRule }> = {
  'America/New_York': {
    standard: { dtstart: '19701101T020000', rrule: 'FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', offsetFrom: '-0400', offsetTo: '-0500', tzname: 'EST' },
    daylight: { dtstart: '19700308T020000', rrule: 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', offsetFrom: '-0500', offsetTo: '-0400', tzname: 'EDT' },
  },
  'America/Chicago': {
    standard: { dtstart: '19701101T020000', rrule: 'FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', offsetFrom: '-0500', offsetTo: '-0600', tzname: 'CST' },
    daylight: { dtstart: '19700308T020000', rrule: 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', offsetFrom: '-0600', offsetTo: '-0500', tzname: 'CDT' },
  },
  'America/Denver': {
    standard: { dtstart: '19701101T020000', rrule: 'FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', offsetFrom: '-0600', offsetTo: '-0700', tzname: 'MST' },
    daylight: { dtstart: '19700308T020000', rrule: 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', offsetFrom: '-0700', offsetTo: '-0600', tzname: 'MDT' },
  },
  'America/Los_Angeles': {
    standard: { dtstart: '19701101T020000', rrule: 'FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', offsetFrom: '-0700', offsetTo: '-0800', tzname: 'PST' },
    daylight: { dtstart: '19700308T020000', rrule: 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', offsetFrom: '-0800', offsetTo: '-0700', tzname: 'PDT' },
  },
  'UTC': {
    standard: { dtstart: '19700101T000000', rrule: '', offsetFrom: '+0000', offsetTo: '+0000', tzname: 'UTC' },
    daylight: { dtstart: '19700101T000000', rrule: '', offsetFrom: '+0000', offsetTo: '+0000', tzname: 'UTC' },
  },
}

interface VTimezoneRule {
  dtstart: string
  rrule: string
  offsetFrom: string
  offsetTo: string
  tzname: string
}

/**
 * Map user-facing status to ICS STATUS values per RFC 5545.
 */
function mapStatus(status: string | null): string | null {
  if (!status) return null
  const lower = status.toLowerCase()
  if (lower === 'confirmed') return 'CONFIRMED'
  if (lower === 'tentative') return 'TENTATIVE'
  if (lower === 'canceled' || lower === 'cancelled') return 'CANCELLED'
  return null
}

/**
 * Escape TEXT values per RFC 5545 Section 3.3.11.
 * Backslash-escapes backslashes, semicolons, and commas.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/**
 * Format a date string (YYYY-MM-DD) as ICS VALUE=DATE (YYYYMMDD).
 */
function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

/**
 * Add N days to a YYYY-MM-DD date string and return YYYYMMDD.
 * Used for DTEND which is exclusive per RFC 5545.
 */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

/**
 * Fold a line at 75 octets per RFC 5545.
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const parts: string[] = []
  let start = 0
  let isFirst = true

  while (start < bytes.length) {
    const maxLen = isFirst ? 75 : 74 // continuation lines have leading space
    let end = start + maxLen

    if (end >= bytes.length) {
      const chunk = new TextDecoder().decode(bytes.slice(start))
      parts.push(isFirst ? chunk : ' ' + chunk)
      break
    }

    // Don't split in the middle of a multi-byte UTF-8 character
    while (end > start && (bytes[end] & 0xc0) === 0x80) {
      end--
    }

    const chunk = new TextDecoder().decode(bytes.slice(start, end))
    parts.push(isFirst ? chunk : ' ' + chunk)
    start = end
    isFirst = false
  }

  return parts.join('\r\n')
}

/**
 * Build the VTIMEZONE block for a given timezone ID.
 */
function buildVTimezone(tzid: string): string[] {
  const rules = TIMEZONE_RULES[tzid]
  const lines: string[] = [
    'BEGIN:VTIMEZONE',
    `TZID:${tzid}`,
  ]

  if (rules) {
    // Standard component
    lines.push('BEGIN:STANDARD')
    lines.push(`DTSTART:${rules.standard.dtstart}`)
    if (rules.standard.rrule) lines.push(`RRULE:${rules.standard.rrule}`)
    lines.push(`TZOFFSETFROM:${rules.standard.offsetFrom}`)
    lines.push(`TZOFFSETTO:${rules.standard.offsetTo}`)
    lines.push(`TZNAME:${rules.standard.tzname}`)
    lines.push('END:STANDARD')

    // Daylight component (skip for UTC)
    if (tzid !== 'UTC') {
      lines.push('BEGIN:DAYLIGHT')
      lines.push(`DTSTART:${rules.daylight.dtstart}`)
      if (rules.daylight.rrule) lines.push(`RRULE:${rules.daylight.rrule}`)
      lines.push(`TZOFFSETFROM:${rules.daylight.offsetFrom}`)
      lines.push(`TZOFFSETTO:${rules.daylight.offsetTo}`)
      lines.push(`TZNAME:${rules.daylight.tzname}`)
      lines.push('END:DAYLIGHT')
    }
  } else {
    // Generic fallback — no DST rules, just the TZID
    lines.push('BEGIN:STANDARD')
    lines.push('DTSTART:19700101T000000')
    lines.push('TZOFFSETFROM:+0000')
    lines.push('TZOFFSETTO:+0000')
    lines.push(`TZNAME:${tzid}`)
    lines.push('END:STANDARD')
  }

  lines.push('END:VTIMEZONE')
  return lines
}

/**
 * Build a single VEVENT block.
 */
function buildVEvent(
  event: ParsedEvent,
  startDate: string,
  endDate: string | null,
  suffix: string,
): string[] {
  const dtstart = formatIcsDate(startDate)
  // DTEND is exclusive — add 1 day
  const dtend = endDate ? addDays(endDate, 1) : addDays(startDate, 1)
  const rawSummary = suffix ? `${event.name} (${suffix})` : event.name
  const summary = escapeIcsText(rawSummary)

  const descParts: string[] = []
  if (event.location) descParts.push(`Location: ${escapeIcsText(event.location)}`)
  if (event.status) descParts.push(`Status: ${escapeIcsText(event.status)}`)
  descParts.push('')
  descParts.push('Generated by ScrapeGoat')
  const description = descParts.join('\\n')

  const icsStatus = mapStatus(event.status)

  const lines: string[] = [
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
  ]

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  }

  lines.push(`UID:${event.id}${suffix ? '-' + suffix.toLowerCase().replace(/[^a-z]/g, '') : ''}@scrapegoat`)

  if (icsStatus) {
    lines.push(`STATUS:${icsStatus}`)
  }

  lines.push('END:VEVENT')
  return lines
}

/**
 * Generate ICS calendar output from selected parsed events.
 * Produces RFC 5545 compliant output with CRLF endings and line folding.
 */
export function generateIcs(
  events: ParsedEvent[],
  options: IcsExportOptions,
  calendarName?: string,
): string {
  const selected = events.filter((e) => e.isSelected)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScrapeGoat//PDF Calendar Extractor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  if (calendarName) {
    lines.push(`X-WR-CALNAME:${calendarName}`)
  }
  lines.push(`X-WR-TIMEZONE:${options.timezone}`)

  // VTIMEZONE block
  lines.push(...buildVTimezone(options.timezone))

  // VEVENTs
  for (const event of selected) {
    if (options.multiPhase) {
      // Separate VEVENTs for each phase
      if (options.includePhases.moveIn && event.moveInDate) {
        const endDate = event.startDate
          ? addDaysIso(event.startDate, -1)
          : event.moveInDate
        lines.push(...buildVEvent(event, event.moveInDate, endDate, 'Move-In'))
      }
      if (options.includePhases.event && event.startDate) {
        lines.push(...buildVEvent(event, event.startDate, event.endDate, 'Event'))
      }
      if (options.includePhases.moveOut && event.moveOutDate) {
        const startDate = event.endDate
          ? addDaysIso(event.endDate, 1)
          : event.moveOutDate
        lines.push(...buildVEvent(event, startDate, event.moveOutDate, 'Move-Out'))
      }
    } else {
      // Single VEVENT using the best available date
      const bestStart = event.startDate ?? event.moveInDate ?? event.moveOutDate
      if (bestStart) {
        lines.push(...buildVEvent(event, bestStart, event.endDate, ''))
      }
    }
  }

  lines.push('END:VCALENDAR')

  // Apply line folding and join with CRLF
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/**
 * Add days to an ISO date string, returning ISO format (YYYY-MM-DD).
 */
function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Default ICS export options. */
export const DEFAULT_ICS_OPTIONS: IcsExportOptions = {
  timezone: 'America/New_York',
  includePhases: { moveIn: true, event: true, moveOut: true },
  multiPhase: true,
}
