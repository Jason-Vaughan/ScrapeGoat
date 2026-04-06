import { describe, it, expect } from 'vitest'
import { generateCsv, DEFAULT_CSV_OPTIONS } from '../exportCsv'
import type { CsvExportOptions } from '../exportCsv'
import type { ParsedEvent } from '../parser'

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    id: 'sha256-abc123',
    name: 'ACME Trade Show',
    startDate: '2026-03-15',
    endDate: '2026-03-18',
    moveInDate: '2026-03-13',
    moveOutDate: '2026-03-20',
    location: 'Hall A',
    status: 'Confirmed',
    customFields: {},
    rawText: 'raw text',
    warnings: [],
    isSelected: true,
    ...overrides,
  }
}

describe('generateCsv', () => {
  it('starts with UTF-8 BOM', () => {
    const result = generateCsv([makeEvent()], DEFAULT_CSV_OPTIONS)
    expect(result.charCodeAt(0)).toBe(0xfeff)
  })

  it('includes header row', () => {
    const result = generateCsv([makeEvent()], DEFAULT_CSV_OPTIONS)
    const lines = result.split('\n')
    // Line 0 starts with BOM then header
    expect(lines[0]).toContain('"Event Name"')
    expect(lines[0]).toContain('"Start Date"')
    expect(lines[0]).toContain('"End Date"')
    expect(lines[0]).toContain('"Location"')
    expect(lines[0]).toContain('"Status"')
  })

  it('quotes all field values', () => {
    const result = generateCsv([makeEvent()], DEFAULT_CSV_OPTIONS)
    const lines = result.split('\n')
    expect(lines[1]).toBe('"ACME Trade Show","2026-03-15","2026-03-18","Hall A","Confirmed"')
  })

  it('escapes quotes by doubling them', () => {
    const event = makeEvent({ name: 'Event "With" Quotes' })
    const result = generateCsv([event], DEFAULT_CSV_OPTIONS)
    expect(result).toContain('"Event ""With"" Quotes"')
  })

  it('handles null fields as empty strings', () => {
    const event = makeEvent({ location: null, status: null })
    const result = generateCsv([event], DEFAULT_CSV_OPTIONS)
    const lines = result.split('\n')
    // Last two fields should be empty quoted
    expect(lines[1]).toContain(',"",""')
  })

  it('respects column selection', () => {
    const opts: CsvExportOptions = {
      delimiter: ',',
      columns: {
        name: true,
        startDate: true,
        endDate: false,
        moveInDate: false,
        moveOutDate: false,
        location: false,
        status: false,
      },
    }
    const result = generateCsv([makeEvent()], opts)
    const lines = result.split('\n')
    expect(lines[0]).toContain('"Event Name"')
    expect(lines[0]).toContain('"Start Date"')
    expect(lines[0]).not.toContain('"End Date"')
    expect(lines[0]).not.toContain('"Location"')
  })

  it('uses tab delimiter', () => {
    const opts: CsvExportOptions = {
      ...DEFAULT_CSV_OPTIONS,
      delimiter: '\t',
      columns: { ...DEFAULT_CSV_OPTIONS.columns },
    }
    const result = generateCsv([makeEvent()], opts)
    const lines = result.split('\n')
    expect(lines[1]).toContain('"ACME Trade Show"\t"2026-03-15"')
  })

  it('uses semicolon delimiter', () => {
    const opts: CsvExportOptions = {
      ...DEFAULT_CSV_OPTIONS,
      delimiter: ';',
      columns: { ...DEFAULT_CSV_OPTIONS.columns },
    }
    const result = generateCsv([makeEvent()], opts)
    const lines = result.split('\n')
    expect(lines[1]).toContain('"ACME Trade Show";"2026-03-15"')
  })

  it('skips unselected events', () => {
    const events = [
      makeEvent(),
      makeEvent({ id: 'b', name: 'Skipped', isSelected: false }),
    ]
    const result = generateCsv(events, DEFAULT_CSV_OPTIONS)
    expect(result).toContain('ACME Trade Show')
    expect(result).not.toContain('Skipped')
  })

  it('includes move-in/move-out columns when selected', () => {
    const opts: CsvExportOptions = {
      delimiter: ',',
      columns: {
        name: true,
        startDate: false,
        endDate: false,
        moveInDate: true,
        moveOutDate: true,
        location: false,
        status: false,
      },
    }
    const result = generateCsv([makeEvent()], opts)
    const lines = result.split('\n')
    expect(lines[0]).toContain('"Move-In Date"')
    expect(lines[0]).toContain('"Move-Out Date"')
    expect(lines[1]).toContain('"2026-03-13"')
    expect(lines[1]).toContain('"2026-03-20"')
  })

  it('ends with a newline', () => {
    const result = generateCsv([makeEvent()], DEFAULT_CSV_OPTIONS)
    expect(result.endsWith('\n')).toBe(true)
  })
})
