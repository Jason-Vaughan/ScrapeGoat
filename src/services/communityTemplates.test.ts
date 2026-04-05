import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchCommunityTemplates, searchCommunityTemplates } from './communityTemplates'
import type { CommunityTemplateEntry } from '../schemas/templateSchema'

const mockIndex = {
  version: '1.0',
  lastUpdated: '2026-04-05',
  templates: [
    {
      id: 'javits-center',
      name: 'Javits Center Calendar',
      file: 'javits-center.json',
      source: 'Jacob K. Javits Convention Center, New York',
      author: 'contributor1',
      created: '2026-04-01',
      lastTested: '2026-04-01',
      eventsTestedCount: 42,
      tags: ['convention-center', 'venue', 'new-york'],
      description: 'Monthly event calendar from the Javits Center',
    },
    {
      id: 'moscone-center',
      name: 'Moscone Center Schedule',
      file: 'moscone-center.json',
      source: 'Moscone Center, San Francisco',
      author: 'contributor2',
      created: '2026-03-15',
      lastTested: '2026-04-01',
      eventsTestedCount: 62,
      tags: ['convention-center', 'venue', 'san-francisco'],
      description: 'Event schedule from Moscone Center',
    },
  ],
}

describe('fetchCommunityTemplates', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('fetches and returns community templates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockIndex), { status: 200 })
    )
    const templates = await fetchCommunityTemplates()
    expect(templates).toHaveLength(2)
    expect(templates[0].id).toBe('javits-center')
  })

  it('caches results in sessionStorage', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockIndex), { status: 200 })
    )
    await fetchCommunityTemplates()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Second call should use cache, not fetch again
    const templates = await fetchCommunityTemplates()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(templates).toHaveLength(2)
  })

  it('throws on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 404 })
    )
    await expect(fetchCommunityTemplates()).rejects.toThrow('Failed to fetch')
  })

  it('throws on invalid index format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ bad: 'data' }), { status: 200 })
    )
    await expect(fetchCommunityTemplates()).rejects.toThrow('invalid format')
  })
})

describe('searchCommunityTemplates', () => {
  const templates = mockIndex.templates as CommunityTemplateEntry[]

  it('returns all templates for empty query', () => {
    expect(searchCommunityTemplates(templates, '')).toHaveLength(2)
    expect(searchCommunityTemplates(templates, '   ')).toHaveLength(2)
  })

  it('filters by name', () => {
    const results = searchCommunityTemplates(templates, 'javits')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('javits-center')
  })

  it('filters by source', () => {
    const results = searchCommunityTemplates(templates, 'San Francisco')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('moscone-center')
  })

  it('filters by tag', () => {
    const results = searchCommunityTemplates(templates, 'new-york')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('javits-center')
  })

  it('filters by description', () => {
    const results = searchCommunityTemplates(templates, 'Monthly')
    expect(results).toHaveLength(1)
  })

  it('is case-insensitive', () => {
    const results = searchCommunityTemplates(templates, 'JAVITS')
    expect(results).toHaveLength(1)
  })

  it('matches across multiple fields', () => {
    // "convention-center" appears in both templates' tags
    const results = searchCommunityTemplates(templates, 'convention-center')
    expect(results).toHaveLength(2)
  })

  it('returns empty for no matches', () => {
    expect(searchCommunityTemplates(templates, 'nonexistent-venue')).toHaveLength(0)
  })
})
