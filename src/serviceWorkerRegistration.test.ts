import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerServiceWorker } from './serviceWorkerRegistration'

describe('registerServiceWorker', () => {
  const originalSW = navigator.serviceWorker

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('does nothing when serviceWorker is not supported', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    })
    // Should not throw
    registerServiceWorker()
  })

  it('does nothing in dev mode', () => {
    // import.meta.env.DEV is true in vitest
    const spy = vi.spyOn(window, 'addEventListener')
    registerServiceWorker()
    expect(spy).not.toHaveBeenCalledWith('load', expect.any(Function))
  })

  it('registers on load in production mode', async () => {
    // Override DEV to false
    const originalDev = import.meta.env.DEV
    // @ts-expect-error writable for test
    import.meta.env.DEV = false

    const registerMock = vi.fn().mockResolvedValue({})
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock },
      configurable: true,
    })

    registerServiceWorker()
    // Trigger the load event
    window.dispatchEvent(new Event('load'))

    // Restore
    // @ts-expect-error writable for test
    import.meta.env.DEV = originalDev

    // Wait for the async registration
    await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('/sw.js')
    })
  })
})
