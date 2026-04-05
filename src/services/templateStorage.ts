import { templateSchema } from '../schemas/templateSchema'
import type { ProfileTemplate, SavedTemplate } from '../schemas/templateSchema'

const STORAGE_KEY = 'scrapegoat_templates'

/**
 * Reads all saved templates from localStorage.
 */
export function listTemplates(): SavedTemplate[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SavedTemplate[]
  } catch {
    return []
  }
}

/**
 * Retrieves a single saved template by ID.
 */
export function getTemplate(id: string): SavedTemplate | null {
  return listTemplates().find((t) => t.id === id) ?? null
}

/**
 * Saves a template to localStorage. If a template with the same ID exists, it is overwritten.
 */
export function saveTemplate(
  id: string,
  template: ProfileTemplate
): SavedTemplate {
  const templates = listTemplates()
  const existing = templates.findIndex((t) => t.id === id)
  const saved: SavedTemplate = {
    id,
    template,
    savedAt: new Date().toISOString(),
    lastUsed: null,
  }

  if (existing >= 0) {
    saved.savedAt = templates[existing].savedAt
    saved.lastUsed = templates[existing].lastUsed
    templates[existing] = saved
  } else {
    templates.push(saved)
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    throw new Error(
      'Storage full. Delete some templates or download them as .json files first.'
    )
  }
  return saved
}

/**
 * Deletes a template from localStorage by ID.
 * Returns true if a template was found and deleted.
 */
export function deleteTemplate(id: string): boolean {
  const templates = listTemplates()
  const filtered = templates.filter((t) => t.id !== id)
  if (filtered.length === templates.length) return false
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  return true
}

/**
 * Updates the lastUsed timestamp for a template.
 */
export function markTemplateUsed(id: string): void {
  const templates = listTemplates()
  const template = templates.find((t) => t.id === id)
  if (template) {
    template.lastUsed = new Date().toISOString()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  }
}

/**
 * Generates a URL-safe ID from a template name.
 */
export function generateTemplateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Downloads a template as a .json file via browser download.
 */
export function downloadTemplate(template: ProfileTemplate): void {
  const json = JSON.stringify(template, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${generateTemplateId(template.name)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Imports a template from a .json file. Validates against the Zod schema.
 * Returns the parsed template or throws on validation failure.
 */
export function importTemplateFromFile(file: File): Promise<ProfileTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string)
        const result = templateSchema.safeParse(json)
        if (!result.success) {
          reject(new Error('Invalid template file: schema validation failed'))
          return
        }
        resolve(result.data)
      } catch {
        reject(new Error('Invalid template file: not valid JSON'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
