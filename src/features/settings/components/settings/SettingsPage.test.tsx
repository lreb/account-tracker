import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from './SettingsPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

interface PWAState {
  isInstallable?: boolean
  isInstalled?: boolean
  isStandalone?: boolean
  isIOS?: boolean
  isMacOS?: boolean
  isSafari?: boolean
  isChromium?: boolean
  isFirefox?: boolean
  isVivaldi?: boolean
}

let pwa: PWAState = {}

const mockInstall = vi.fn()

vi.mock('../../hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({
    isInstallable: false,
    isInstalled: false,
    isStandalone: false,
    isIOS: false,
    isMacOS: false,
    isSafari: false,
    isChromium: false,
    isFirefox: false,
    isVivaldi: false,
    install: mockInstall,
    ...pwa,
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<SettingsPage />)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsPage install section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pwa = {}
  })

  it('reports the app as installed when running standalone', () => {
    pwa = { isStandalone: true, isInstalled: true }
    renderPage()
    expect(screen.getByText('settings.installAppInstalledTitle')).toBeInTheDocument()
  })

  it('warns when installed but opened in a browser tab', () => {
    pwa = { isInstalled: true, isStandalone: false }
    renderPage()
    expect(screen.getByText('settings.installAppInstalledInBrowserTitle')).toBeInTheDocument()
  })

  it('offers the install button when the browser fired beforeinstallprompt', () => {
    pwa = { isInstallable: true }
    renderPage()
    expect(screen.getByText('settings.installAppBtn')).toBeInTheDocument()
  })

  it('calls install() when the install button is clicked', () => {
    pwa = { isInstallable: true }
    renderPage()
    fireEvent.click(screen.getByText('settings.installAppBtn'))
    expect(mockInstall).toHaveBeenCalledTimes(1)
  })

  it('shows the iOS Add to Home Screen steps', () => {
    pwa = { isIOS: true }
    renderPage()
    expect(screen.getByText('settings.installAppIOSStep1')).toBeInTheDocument()
  })

  it('shows the macOS Add to Dock steps in Safari', () => {
    pwa = { isMacOS: true, isSafari: true }
    renderPage()
    expect(screen.getByText('settings.installAppMacOSStep1')).toBeInTheDocument()
  })

  it('tells Chromium users to use the manual install affordance', () => {
    pwa = { isChromium: true }
    renderPage()
    expect(screen.getByText('settings.installAppChromiumHint')).toBeInTheDocument()
  })

  it('never tells Chromium users to switch to another browser', () => {
    pwa = { isChromium: true }
    renderPage()
    expect(screen.queryByText('settings.installAppBrowserHint')).not.toBeInTheDocument()
  })

  it('shows Firefox menu steps instead of sending Firefox users to Chrome or Edge', () => {
    pwa = { isFirefox: true }
    renderPage()
    expect(screen.getByText('settings.installAppFirefoxStep1')).toBeInTheDocument()
    expect(screen.queryByText('settings.installAppBrowserHint')).not.toBeInTheDocument()
  })

  it('never shows the Chromium hint to Firefox', () => {
    pwa = { isFirefox: true }
    renderPage()
    expect(screen.queryByText('settings.installAppChromiumHint')).not.toBeInTheDocument()
  })

  it('shows the Chromium hint (with Vivaldi mention) to Vivaldi users', () => {
    pwa = { isVivaldi: true, isChromium: true }
    renderPage()
    expect(screen.getByText('settings.installAppChromiumHint')).toBeInTheDocument()
    expect(screen.queryByText('settings.installAppBrowserHint')).not.toBeInTheDocument()
  })

  it('sends unknown non-Chromium, non-Firefox browsers to Chrome or Edge', () => {
    pwa = {}
    renderPage()
    expect(screen.getByText('settings.installAppBrowserHint')).toBeInTheDocument()
  })

  it('keeps the installable button ahead of the Chromium fallback', () => {
    pwa = { isInstallable: true, isChromium: true }
    renderPage()
    expect(screen.getByText('settings.installAppBtn')).toBeInTheDocument()
    expect(screen.queryByText('settings.installAppChromiumHint')).not.toBeInTheDocument()
  })

  it('keeps the installable button ahead of the Firefox fallback', () => {
    pwa = { isInstallable: true, isFirefox: true }
    renderPage()
    expect(screen.getByText('settings.installAppBtn')).toBeInTheDocument()
    expect(screen.queryByText('settings.installAppFirefoxStep1')).not.toBeInTheDocument()
  })

  it('renders the settings navigation list', () => {
    renderPage()
    expect(screen.getByText('settings.preferencesTitle')).toBeInTheDocument()
    expect(screen.getByText('settings.aiAssistantTitle')).toBeInTheDocument()
  })
})
