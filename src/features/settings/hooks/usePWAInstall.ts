import { useState, useEffect, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface UsePWAInstallReturn {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  install: () => Promise<void>
}

function detectIOS(): boolean {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return true
  // iPadOS 13+ reports "MacIntel" with touch support
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => {
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
    return (
      standaloneMediaQuery.matches ||
      ('standalone' in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true)
    )
  })
  const isInstallingRef = useRef(false)

  const isIOS = detectIOS()

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
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
    isIOS,
    install,
  }
}
