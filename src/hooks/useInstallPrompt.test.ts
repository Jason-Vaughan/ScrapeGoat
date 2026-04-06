import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt'

describe('useInstallPrompt', () => {
  it('starts with canInstall false', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
  })

  it('captures beforeinstallprompt event', () => {
    const { result } = renderHook(() => useInstallPrompt())

    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.canInstall).toBe(true)
  })

  it('calls prompt() on install and clears on accept', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    const promptFn = vi.fn().mockResolvedValue(undefined)
    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: promptFn,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.canInstall).toBe(true)

    await act(async () => {
      await result.current.install()
    })

    expect(promptFn).toHaveBeenCalled()
    expect(result.current.canInstall).toBe(false)
  })

  it('keeps canInstall true when user dismisses', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    const mockEvent = new Event('beforeinstallprompt')
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    await act(async () => {
      await result.current.install()
    })

    expect(result.current.canInstall).toBe(true)
  })

  it('cleans up event listener on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useInstallPrompt())

    unmount()

    expect(spy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    spy.mockRestore()
  })
})
