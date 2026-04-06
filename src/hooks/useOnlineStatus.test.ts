import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  const originalOnLine = navigator.onLine

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    })
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns false when browser is offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.wizardAvailable).toBe(false)
  })

  it('returns false when VITE_API_URL is not set', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    })
    vi.stubEnv('VITE_API_URL', '')
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.wizardAvailable).toBe(false)
  })

  it('returns true optimistically when online with API URL', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    })
    vi.stubEnv('VITE_API_URL', 'https://example.com')
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current.wizardAvailable).toBe(true)
  })

  it('sets false when probe fails', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    })
    vi.stubEnv('VITE_API_URL', 'https://example.com')
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useOnlineStatus())
    await vi.waitFor(() => {
      expect(result.current.wizardAvailable).toBe(false)
    })
  })

  it('responds to offline event', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    })
    vi.stubEnv('VITE_API_URL', 'https://example.com')
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    const { result } = renderHook(() => useOnlineStatus())

    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.wizardAvailable).toBe(false)
  })
})
