import { useCallback, useEffect, useRef, useState } from 'react'

/** Turnstile site key from environment. */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

/** URL for the Turnstile API script. */
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

/** Global flag: has the script tag been injected? */
let scriptInjected = false

/**
 * Hook that manages Cloudflare Turnstile verification.
 * Loads the Turnstile script, renders the widget, and provides the token.
 *
 * @returns token (string | null), reset function, container ref, and ready state
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  // Load the Turnstile script once
  useEffect(() => {
    if (!SITE_KEY) return

    if (scriptInjected) {
      // Script already loaded or loading — wait for it
      if (window.turnstile) {
        setReady(true)
      } else {
        const check = setInterval(() => {
          if (window.turnstile) {
            setReady(true)
            clearInterval(check)
          }
        }, 100)
        return () => clearInterval(check)
      }
      return
    }

    scriptInjected = true
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])

  // Render the widget once script is ready and container is mounted
  useEffect(() => {
    if (!ready || !SITE_KEY || !containerRef.current || !window.turnstile) return

    // Avoid double-render
    if (widgetIdRef.current !== null) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (t: string) => setToken(t),
      'expired-callback': () => setToken(null),
      'error-callback': () => setToken(null),
    })
  }, [ready])

  /** Reset the widget to get a fresh token. */
  const reset = useCallback(() => {
    setToken(null)
    if (widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [])

  return {
    /** The current Turnstile token, or null if not yet verified. */
    token,
    /** Reset the widget to obtain a new token. */
    reset,
    /** Ref to attach to the container div where the widget renders. */
    containerRef,
    /** Whether the Turnstile script has loaded. */
    ready,
    /** Whether Turnstile is configured (site key present). */
    configured: !!SITE_KEY,
  }
}

// ---------------------------------------------------------------------------
// Augment Window for Turnstile global
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}
