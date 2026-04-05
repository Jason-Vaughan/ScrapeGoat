import { communityIndexSchema } from '../schemas/templateSchema'
import type { CommunityTemplateEntry } from '../schemas/templateSchema'

const CACHE_KEY = 'scrapegoat_community_index'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

interface CachedIndex {
  data: CommunityTemplateEntry[]
  fetchedAt: number
}

/**
 * Builds the raw GitHub URL for the community template index.
 */
function getIndexUrl(): string {
  return 'https://raw.githubusercontent.com/Jason-Vaughan/ScrapeGoat/main/templates/index.json'
}

/**
 * Reads cached community index from sessionStorage if still fresh.
 */
function getCachedIndex(): CommunityTemplateEntry[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedIndex = JSON.parse(raw)
    if (Date.now() - cached.fetchedAt > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.data
  } catch {
    return null
  }
}

/**
 * Caches the community index in sessionStorage.
 */
function setCachedIndex(data: CommunityTemplateEntry[]): void {
  const cached: CachedIndex = { data, fetchedAt: Date.now() }
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch {
    // sessionStorage quota exceeded — silently skip caching
  }
}

/**
 * Fetches the community template index from the GitHub repo.
 * Uses sessionStorage cache with 1-hour TTL.
 */
export async function fetchCommunityTemplates(): Promise<
  CommunityTemplateEntry[]
> {
  const cached = getCachedIndex()
  if (cached) return cached

  const response = await fetch(getIndexUrl())
  if (!response.ok) {
    throw new Error(`Failed to fetch community templates: ${response.status}`)
  }

  const json = await response.json()
  const result = communityIndexSchema.safeParse(json)
  if (!result.success) {
    throw new Error('Community template index has invalid format')
  }

  setCachedIndex(result.data.templates)
  return result.data.templates
}

/**
 * Searches community templates by name, source, tags, and description.
 * Case-insensitive substring match.
 */
export function searchCommunityTemplates(
  templates: CommunityTemplateEntry[],
  query: string
): CommunityTemplateEntry[] {
  if (!query.trim()) return templates

  const lower = query.toLowerCase()
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.source.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lower))
  )
}
