import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTurnstile } from './useTurnstile'

describe('useTurnstile', () => {
  beforeEach(() => {
    // Clear any previous Turnstile mock
    delete (window as Record<string, unknown>).turnstile
    // Reset env var
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns configured=false when no site key', () => {
    const { result } = renderHook(() => useTurnstile())
    expect(result.current.configured).toBe(false)
    expect(result.current.token).toBeNull()
  })

  it('provides a containerRef', () => {
    const { result } = renderHook(() => useTurnstile())
    expect(result.current.containerRef).toBeDefined()
    expect(result.current.containerRef.current).toBeNull()
  })

  it('reset clears the token', () => {
    const { result } = renderHook(() => useTurnstile())
    act(() => {
      result.current.reset()
    })
    expect(result.current.token).toBeNull()
  })
})
