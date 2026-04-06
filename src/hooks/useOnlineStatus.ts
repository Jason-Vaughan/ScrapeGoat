import { useState, useEffect } from 'react'

/**
 * Detects whether the AI wizard proxy is likely reachable.
 * Returns false when the browser is offline or the VITE_API_URL env var is not set.
 * When online with an API URL configured, probes the proxy endpoint once on mount.
 */
export function useOnlineStatus() {
  const [wizardAvailable, setWizardAvailable] = useState(() => {
    if (!navigator.onLine) return false
    if (!import.meta.env.VITE_API_URL) return false
    return true // optimistic until probe completes
  })

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL

    const update = () => {
      if (!navigator.onLine || !apiUrl) {
        setWizardAvailable(false)
        return
      }
      setWizardAvailable(true)
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    // Probe the proxy with a HEAD-like OPTIONS request (5s timeout)
    if (navigator.onLine && apiUrl) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      fetch(`${apiUrl}/api/analyze`, {
        method: 'OPTIONS',
        signal: controller.signal,
      })
        .then((res) => setWizardAvailable(res.ok || res.status === 405 || res.status === 204))
        .catch(() => setWizardAvailable(false))
        .finally(() => clearTimeout(timeoutId))

      return () => {
        clearTimeout(timeoutId)
        controller.abort()
        window.removeEventListener('online', update)
        window.removeEventListener('offline', update)
      }
    }

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return { wizardAvailable }
}
