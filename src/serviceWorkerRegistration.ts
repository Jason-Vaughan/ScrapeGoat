/**
 * Registers the service worker for offline caching.
 * Only registers in production — Vite dev server handles HMR.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failed — app still works, just no offline caching
    })
  })
}
