import { describe, it, expect, beforeEach } from 'vitest'
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  markTemplateUsed,
  generateTemplateId,
  importTemplateFromFile,
} from './templateStorage'
import type { ProfileTemplate } from '../schemas/templateSchema'

/** A minimal valid template for testing. */
const mockTemplate: ProfileTemplate = {
  name: 'Test Calendar',
  version: '1.0',
  structure: { type: 'block', blockDelimiter: '^\\d+' },
  dateFormats: [{ pattern: '(?<month>\\d+)/(?<day>\\d+)/(?<year>\\d+)', fields: ['startDate'] }],
  fields: {},
}

describe('templateStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no templates saved', () => {
    expect(listTemplates()).toEqual([])
  })

  it('saves and retrieves a template', () => {
    saveTemplate('test-cal', mockTemplate)
    const list = listTemplates()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('test-cal')
    expect(list[0].template.name).toBe('Test Calendar')
  })

  it('retrieves a template by ID', () => {
    saveTemplate('test-cal', mockTemplate)
    const found = getTemplate('test-cal')
    expect(found).not.toBeNull()
    expect(found!.template.name).toBe('Test Calendar')
  })

  it('returns null for unknown ID', () => {
    expect(getTemplate('nonexistent')).toBeNull()
  })

  it('overwrites existing template with same ID', () => {
    saveTemplate('test-cal', mockTemplate)
    const updated = { ...mockTemplate, name: 'Updated Calendar' }
    saveTemplate('test-cal', updated)
    const list = listTemplates()
    expect(list).toHaveLength(1)
    expect(list[0].template.name).toBe('Updated Calendar')
  })

  it('deletes a template and returns true', () => {
    saveTemplate('test-cal', mockTemplate)
    expect(deleteTemplate('test-cal')).toBe(true)
    expect(listTemplates()).toHaveLength(0)
  })

  it('returns false when deleting nonexistent template', () => {
    expect(deleteTemplate('nonexistent')).toBe(false)
  })

  it('updates lastUsed on markTemplateUsed', () => {
    saveTemplate('test-cal', mockTemplate)
    expect(getTemplate('test-cal')!.lastUsed).toBeNull()
    markTemplateUsed('test-cal')
    expect(getTemplate('test-cal')!.lastUsed).not.toBeNull()
  })

  it('handles multiple templates', () => {
    saveTemplate('cal-1', mockTemplate)
    saveTemplate('cal-2', { ...mockTemplate, name: 'Second Calendar' })
    expect(listTemplates()).toHaveLength(2)
    deleteTemplate('cal-1')
    expect(listTemplates()).toHaveLength(1)
    expect(listTemplates()[0].id).toBe('cal-2')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('scrapegoat_templates', 'not-json')
    expect(listTemplates()).toEqual([])
  })
})

describe('generateTemplateId', () => {
  it('converts name to URL-safe slug', () => {
    expect(generateTemplateId('Javits Center Calendar')).toBe('javits-center-calendar')
  })

  it('strips special characters', () => {
    expect(generateTemplateId("Bob's Events (2026)")).toBe('bob-s-events-2026')
  })

  it('trims leading/trailing hyphens', () => {
    expect(generateTemplateId('--test--')).toBe('test')
  })
})

describe('importTemplateFromFile', () => {
  it('imports a valid template file', async () => {
    const json = JSON.stringify(mockTemplate)
    const file = new File([json], 'template.json', { type: 'application/json' })
    const result = await importTemplateFromFile(file)
    expect(result.name).toBe('Test Calendar')
  })

  it('rejects invalid JSON', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    await expect(importTemplateFromFile(file)).rejects.toThrow('not valid JSON')
  })

  it('rejects JSON that fails schema validation', async () => {
    const file = new File(['{"foo":"bar"}'], 'bad.json', { type: 'application/json' })
    await expect(importTemplateFromFile(file)).rejects.toThrow('schema validation failed')
  })

  it('rejects file read errors', async () => {
    const file = new File([], 'empty.json', { type: 'application/json' })
    // Spy on FileReader to simulate error
    const originalFileReader = globalThis.FileReader
    globalThis.FileReader = class extends originalFileReader {
      readAsText() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Event('error') as ProgressEvent<FileReader>)
        }, 0)
      }
    } as unknown as typeof FileReader
    await expect(importTemplateFromFile(file)).rejects.toThrow('Failed to read file')
    globalThis.FileReader = originalFileReader
  })
})
