import { z } from 'zod'

/** Zod schema for event name extraction configuration. */
const eventNameFieldSchema = z.object({
  pattern: z.string().optional(),
  position: z
    .enum(['first_line', 'after_date', 'before_date', 'regex'])
    .optional(),
})

/** Zod schema for location extraction configuration. */
const locationFieldSchema = z.object({
  knownValues: z.array(z.string()).optional(),
  pattern: z.string().optional(),
})

/** Zod schema for status extraction configuration. */
const statusFieldSchema = z.object({
  knownValues: z.array(z.string()).optional(),
  pattern: z.string().optional(),
})

/** Zod schema for custom field definitions. */
const customFieldSchema = z.object({
  name: z.string(),
  pattern: z.string(),
  description: z.string().optional(),
})

/** Zod schema for date format patterns. */
const dateFormatSchema = z.object({
  pattern: z.string(),
  format: z.string().optional(),
  fields: z.array(
    z.enum(['startDate', 'endDate', 'moveInDate', 'moveOutDate', 'singleDate'])
  ),
})

/** Zod schema for document structure configuration. */
const structureSchema = z.object({
  type: z.enum(['block', 'table', 'list']),
  blockDelimiter: z.string().optional(),
  tableHeaders: z.array(z.string()).optional(),
  linePattern: z.string().optional(),
})

/**
 * Zod schema for a ScrapeGoat template profile (spec 5.1).
 * Validates template JSON before storage or use.
 */
export const templateSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  author: z.string().optional(),
  source: z.string().optional(),
  created: z.string().optional(),
  lastTested: z.string().optional(),
  eventsTestedCount: z.number().int().nonnegative().optional(),
  structure: structureSchema,
  dateFormats: z.array(dateFormatSchema).min(1),
  fields: z.object({
    eventName: eventNameFieldSchema.optional(),
    location: locationFieldSchema.optional(),
    status: statusFieldSchema.optional(),
  }),
  timezone: z.string().nullable().optional(),
  customFields: z.array(customFieldSchema).optional(),
})

/** TypeScript type inferred from the Zod template schema. */
export type ProfileTemplate = z.infer<typeof templateSchema>

/**
 * A saved template stored in localStorage, with additional metadata.
 */
export interface SavedTemplate {
  id: string
  template: ProfileTemplate
  savedAt: string
  lastUsed: string | null
}

/**
 * Entry from the community template index (templates/index.json).
 */
export interface CommunityTemplateEntry {
  id: string
  name: string
  file: string
  source: string
  author: string
  created: string
  lastTested: string
  eventsTestedCount: number
  tags: string[]
  description: string
}

/** Schema for the community template index file. */
export const communityIndexSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  templates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      file: z.string(),
      source: z.string(),
      author: z.string(),
      created: z.string(),
      lastTested: z.string(),
      eventsTestedCount: z.number().int().nonnegative(),
      tags: z.array(z.string()),
      description: z.string(),
    })
  ),
})
