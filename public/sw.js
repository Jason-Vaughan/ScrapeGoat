/**
 * ScrapeGoat Service Worker
 *
 * Caches the app shell for offline use. Parsing and export work offline —
 * only the AI wizard requires a network connection.
 *
 * Strategy:
 * - Static assets (JS, CSS, icons): cache-first with runtime caching
 * - Navigation (HTML): network-first with cache fallback
 * - API calls (/api/*): network-only (never cached by SW)
 *
 * Note: Only the HTML shell is precached. JS/CSS bundles are cached on
 * first visit via the cache-first runtime strategy. Full offline support
 * requires at least one prior visit to populate the cache.
 */

const CACHE_NAME = 'scrapegoat-v1'

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache API calls — wizard needs live network
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Never cache chrome-extension or non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // Navigation requests: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
