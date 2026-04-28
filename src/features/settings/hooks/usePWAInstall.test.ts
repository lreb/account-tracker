import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePWAInstall } from './usePWAInstall'

// ——— helpers ———

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

function setNavigator(overrides: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
}) {
  if (overrides.userAgent !== undefined) {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => overrides.userAgent,
      configurable: true,
    })
  }
  if (overrides.platform !== undefined) {
    Object.defineProperty(navigator, 'platform', {
      get: () => overrides.platform,
      configurable: true,
    })
  }
  if (overrides.maxTouchPoints !== undefined) {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => overrides.maxTouchPoints,
      configurable: true,
    })
  }
}

function makeInstallEvent(opts: {
  prompt?: () => Promise<void>
  outcome?: 'accepted' | 'dismissed'
}) {
  const promptFn = vi.fn().mockImplementation(opts.prompt ?? (() => Promise.resolve()))
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: promptFn,
    userChoice: Promise.resolve({ outcome: opts.outcome ?? 'dismissed' }),
  })
  return { event, promptFn }
}

// ——— tests ———

describe('usePWAInstall', () => {
  beforeEach(() => {
    mockMatchMedia(false)
    setNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      maxTouchPoints: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with isInstallable false, isInstalled false, isIOS false', () => {
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isInstallable).toBe(false)
      expect(result.current.isInstalled).toBe(false)
      expect(result.current.isIOS).toBe(false)
      expect(typeof result.current.install).toBe('function')
    })

    it('sets isInstalled true when display-mode is standalone', () => {
      mockMatchMedia(true)
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isInstalled).toBe(true)
    })
  })

  // ── isIOS detection ──────────────────────────────────────────────────────

  describe('isIOS detection', () => {
    it('detects iPhone user agent', () => {
      setNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' })
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isIOS).toBe(true)
    })

    it('detects legacy iPad user agent', () => {
      setNavigator({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)' })
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isIOS).toBe(true)
    })

    it('detects iPod user agent', () => {
      setNavigator({ userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)' })
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isIOS).toBe(true)
    })

    it('detects iPadOS 13+ via MacIntel + maxTouchPoints > 1', () => {
      setNavigator({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isIOS).toBe(true)
    })

    it('does NOT detect a Mac desktop as iOS (MacIntel, 0 touch points)', () => {
      setNavigator({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      })
      const { result } = renderHook(() => usePWAInstall())
      expect(result.current.isIOS).toBe(false)
    })
  })

  // ── beforeinstallprompt event ────────────────────────────────────────────

  describe('beforeinstallprompt', () => {
    it('sets isInstallable to true when the event fires', () => {
      const { result } = renderHook(() => usePWAInstall())
      const { event } = makeInstallEvent({})
      act(() => {
        window.dispatchEvent(event)
      })
      expect(result.current.isInstallable).toBe(true)
    })

    it('does not change isInstalled', () => {
      const { result } = renderHook(() => usePWAInstall())
      const { event } = makeInstallEvent({})
      act(() => {
        window.dispatchEvent(event)
      })
      expect(result.current.isInstalled).toBe(false)
    })
  })

  // ── appinstalled event ───────────────────────────────────────────────────

  describe('appinstalled', () => {
    it('sets isInstalled true and clears isInstallable', () => {
      const { result } = renderHook(() => usePWAInstall())
      const { event } = makeInstallEvent({})
      act(() => {
        window.dispatchEvent(event)
      })
      expect(result.current.isInstallable).toBe(true)

      act(() => {
        window.dispatchEvent(new Event('appinstalled'))
      })
      expect(result.current.isInstalled).toBe(true)
      expect(result.current.isInstallable).toBe(false)
    })

    it('sets isInstalled true even without a prior beforeinstallprompt', () => {
      const { result } = renderHook(() => usePWAInstall())
      act(() => {
        window.dispatchEvent(new Event('appinstalled'))
      })
      expect(result.current.isInstalled).toBe(true)
    })
  })

  // ── install() ────────────────────────────────────────────────────────────

  describe('install()', () => {
    it('resolves without error when deferredPrompt is null', async () => {
      const { result } = renderHook(() => usePWAInstall())
      await expect(act(() => result.current.install())).resolves.toBeUndefined()
    })

    it('calls prompt.prompt() exactly once', async () => {
      const { result } = renderHook(() => usePWAInstall())
      const { event, promptFn } = makeInstallEvent({})
      act(() => {
        window.dispatchEvent(event)
      })
      await act(() => result.current.install())
      expect(promptFn).toHaveBeenCalledTimes(1)
    })

    it('clears isInstallable after the call completes', async () => {
      const { result } = renderHook(() => usePWAInstall())
      const { event } = makeInstallEvent({})
      act(() => {
        window.dispatchEvent(event)
      })
      await act(() => result.current.install())
      expect(result.current.isInstallable).toBe(false)
    })

    it('does NOT set isInstalled on "accepted" outcome — only appinstalled event does', async () => {
      const { result } = renderHook(() => usePWAInstall())
      const { event } = makeInstallEvent({ outcome: 'accepted' })
      act(() => {
        window.dispatchEvent(event)
      })
      await act(() => result.current.install())
      // appinstalled was never fired — isInstalled must stay false
      expect(result.current.isInstalled).toBe(false)
    })

    it('blocks a concurrent second call via isInstallingRef (double-click guard)', async () => {
      const { result } = renderHook(() => usePWAInstall())
      let resolvePrompt!: () => void
      const { event, promptFn } = makeInstallEvent({
        prompt: () => new Promise<void>((r) => { resolvePrompt = r }),
      })
      act(() => {
        window.dispatchEvent(event)
      })

      // Fire two calls before the first await resolves
      const first = result.current.install()
      const second = result.current.install()

      await act(async () => {
        resolvePrompt()
        await Promise.all([first, second])
      })

      expect(promptFn).toHaveBeenCalledTimes(1)
    })

    it('restores the deferred prompt and logs on prompt() failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => usePWAInstall())
      const err = new Error('prompt rejected by browser')
      const { event } = makeInstallEvent({ prompt: () => Promise.reject(err) })
      act(() => {
        window.dispatchEvent(event)
      })

      await act(() => result.current.install())

      expect(result.current.isInstallable).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith('[usePWAInstall] install() failed:', err)
    })

    it('resets isInstallingRef in finally so a retry after failure works', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => usePWAInstall())
      let callCount = 0
      const { event, promptFn } = makeInstallEvent({
        prompt: () => {
          callCount++
          return callCount === 1 ? Promise.reject(new Error('first fails')) : Promise.resolve()
        },
      })
      act(() => {
        window.dispatchEvent(event)
      })

      // First call fails — prompt is restored
      await act(() => result.current.install())
      expect(result.current.isInstallable).toBe(true)

      // Second call should proceed — isInstallingRef was reset in finally
      await act(() => result.current.install())
      expect(promptFn).toHaveBeenCalledTimes(2)
    })
  })

  // ── cleanup ──────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('removes both event listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => usePWAInstall())
      unmount()
      expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function))
    })
  })
})
