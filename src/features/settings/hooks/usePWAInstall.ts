import { useState, useEffect, useRef } from 'react'

const PWA_INSTALLED_KEY = 'pwa-installed'
// Persisted for the lifetime of the OS-level app session so that navigations
// within the PWA don't lose the standalone flag (the ?source=pwa param is only
// present on the very first load after the OS launches the app).
const PWA_STANDALONE_SESSION_KEY = 'pwa-standalone-session'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface UsePWAInstallReturn {
  /** True when the browser has fired `beforeinstallprompt` and we can trigger installation. */
  isInstallable: boolean
  /**
   * True when the app is known to be installed on the device (either the current session
   * is running in standalone mode, or `appinstalled` was fired in a previous session).
   * NOTE: this can be true even while the user is browsing in a regular browser tab —
   * use `isStandalone` to check the *current* display context.
   */
  isInstalled: boolean
  /**
   * True when the current session was launched from the home screen icon (standalone).
   * Detection order:
   *   1. sessionStorage flag set by a previous navigation in this OS session
   *   2. `?source=pwa` query param injected by the `start_url` manifest entry
   *   3. `display-mode: standalone/fullscreen` CSS media query (fallback)
   *   4. `navigator.standalone` (iOS Safari)
   */
  isStandalone: boolean
  isIOS: boolean
  install: () => Promise<void>
}

function detectIOS(): boolean {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return true
  // iPadOS 13+ reports "MacIntel" with touch support
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function getIsStandalone(): boolean {
  // 1. Session flag — set on the initial load of a home-screen launch and carried
  //    through all in-app navigations (the ?source=pwa param is stripped after detection).
  if (sessionStorage.getItem(PWA_STANDALONE_SESSION_KEY) === '1') return true

  // 2. start_url param — present only when the OS launches the PWA via the home screen
  //    shortcut. Strip it immediately so it never appears in the address bar or router.
  const params = new URLSearchParams(window.location.search)
  if (params.get('source') === 'pwa') {
    sessionStorage.setItem(PWA_STANDALONE_SESSION_KEY, '1')
    params.delete('source')
    const newSearch = params.toString()
    const cleanUrl =
      window.location.pathname +
      (newSearch ? `?${newSearch}` : '') +
      window.location.hash
    window.history.replaceState(null, '', cleanUrl)
    return true
  }

  // 3. `(display-mode: browser)` is the spec-defined default for a regular browser tab.
  //    Checking it as a NEGATIVE signal is more reliable than checking standalone/fullscreen
  //    positively, because older Android WebAPK builds may not set standalone correctly
  //    but will always clear the browser flag.
  if (window.matchMedia('(display-mode: browser)').matches) {
    // Definitively in a browser tab — not standalone.
    return false
  }

  // 4. Not in browser mode — verify with explicit standalone variants and persist.
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  ) {
    sessionStorage.setItem(PWA_STANDALONE_SESSION_KEY, '1')
    return true
  }

  // 5. iOS Safari standalone flag.
  if (
    'standalone' in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  ) {
    sessionStorage.setItem(PWA_STANDALONE_SESSION_KEY, '1')
    return true
  }

  return false
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // `isStandalone` reflects the *current* display mode and updates reactively.
  const [isStandalone, setIsStandalone] = useState(getIsStandalone)

  // `isInstalled` is true when the app is on the home screen, regardless of how it was
  // opened this session. We persist this to localStorage so the "already installed" UI
  // state survives a cold browser-tab open (the user might be checking settings while
  // the app is also on their home screen).
  const [isInstalled, setIsInstalled] = useState(() => {
    return getIsStandalone() || localStorage.getItem(PWA_INSTALLED_KEY) === 'true'
  })

  const isInstallingRef = useRef(false)

  const isIOS = detectIOS()

  // Keep isStandalone in sync with display-mode media query changes (e.g. user drags the
  // PWA window into a browser tab on desktop, or the OS opens the PWA in a tab after an
  // update resets its launch mode).
  // We also run an extra check after mount because on some Android WebAPK builds the
  // display-mode media queries are not fully initialized during the synchronous first
  // render — the post-mount effect gives the browser a tick to settle.
  useEffect(() => {
    // Post-mount re-check (covers late display-mode initialization on Android).
    setIsStandalone(getIsStandalone())

    const queries = [
      window.matchMedia('(display-mode: browser)'),
      window.matchMedia('(display-mode: standalone)'),
      window.matchMedia('(display-mode: fullscreen)'),
      window.matchMedia('(display-mode: minimal-ui)'),
    ]
    const onDisplayModeChange = () => setIsStandalone(getIsStandalone())
    queries.forEach((q) => q.addEventListener('change', onDisplayModeChange))
    return () => queries.forEach((q) => q.removeEventListener('change', onDisplayModeChange))
  }, [])

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      localStorage.setItem(PWA_INSTALLED_KEY, 'true')
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferredPrompt || isInstallingRef.current) return
    isInstallingRef.current = true
    // Clear prompt state before awaiting so a concurrent call cannot reach prompt()
    const prompt = deferredPrompt
    setDeferredPrompt(null)
    try {
      await prompt.prompt()
      // Outcome is informational only — definitive "installed" signal comes from the
      // appinstalled event listener above; do not set isInstalled here.
      await prompt.userChoice
    } catch (err) {
      // Restore prompt so the user can retry if the browser rejects the call
      setDeferredPrompt(prompt)
      console.error('[usePWAInstall] install() failed:', err)
    } finally {
      isInstallingRef.current = false
    }
  }

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isStandalone,
    isIOS,
    install,
  }
}
