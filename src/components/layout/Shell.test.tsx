import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Shell from './Shell'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useLocation: () => ({ pathname: '/' }),
    Outlet: () => <div data-testid="outlet" />,
  }
})

let mockIsInstalled = false
let mockIsStandalone = false

vi.mock('@/features/settings/hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({
    isInstalled: mockIsInstalled,
    isStandalone: mockIsStandalone,
  }),
}))

vi.mock('./Header', () => ({
  default: ({ onMenuToggle }: { onMenuToggle: () => void }) => (
    <div data-testid="header">
      <button onClick={onMenuToggle}>toggle-sidebar</button>
    </div>
  ),
}))

vi.mock('./Sidebar', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="sidebar" data-open={String(open)}>
      <button onClick={onClose}>close-sidebar</button>
    </div>
  ),
}))

vi.mock('./ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderShell() {
  return render(
    <MemoryRouter>
      <Shell />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInstalled = false
    mockIsStandalone = false
  })

  describe('core structure', () => {
    it('renders Header', () => {
      renderShell()
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('renders Sidebar', () => {
      renderShell()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    it('renders the main scroll container', () => {
      renderShell()
      expect(document.getElementById('main-scroll')).toBeInTheDocument()
    })

    it('renders the Outlet inside main', () => {
      renderShell()
      expect(screen.getByTestId('outlet')).toBeInTheDocument()
    })
  })

  describe('PWA browser banner', () => {
    it('does not show the banner when the app is not installed', () => {
      mockIsInstalled = false
      mockIsStandalone = false
      renderShell()
      expect(screen.queryByText('shell.openInAppBanner')).not.toBeInTheDocument()
    })

    it('does not show the banner when running in standalone mode', () => {
      mockIsInstalled = true
      mockIsStandalone = true
      renderShell()
      expect(screen.queryByText('shell.openInAppBanner')).not.toBeInTheDocument()
    })

    it('shows the banner when installed but opened in a browser tab', () => {
      mockIsInstalled = true
      mockIsStandalone = false
      renderShell()
      expect(screen.getByText('shell.openInAppBanner')).toBeInTheDocument()
    })

    it('hides the banner after clicking the dismiss button', () => {
      mockIsInstalled = true
      mockIsStandalone = false
      renderShell()
      expect(screen.getByText('shell.openInAppBanner')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'common.dismiss' }))
      expect(screen.queryByText('shell.openInAppBanner')).not.toBeInTheDocument()
    })
  })

  describe('sidebar toggle', () => {
    it('sidebar starts closed', () => {
      renderShell()
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
    })

    it('opens the sidebar when Header fires onMenuToggle', () => {
      renderShell()
      fireEvent.click(screen.getByRole('button', { name: 'toggle-sidebar' }))
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true')
    })

    it('closes the sidebar via the sidebar onClose callback', () => {
      renderShell()
      fireEvent.click(screen.getByRole('button', { name: 'toggle-sidebar' }))
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true')
      fireEvent.click(screen.getByRole('button', { name: 'close-sidebar' }))
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
    })

    it('toggles the sidebar closed again on a second menu toggle click', () => {
      renderShell()
      const toggleBtn = screen.getByRole('button', { name: 'toggle-sidebar' })
      fireEvent.click(toggleBtn)
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true')
      fireEvent.click(toggleBtn)
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
    })
  })
})
