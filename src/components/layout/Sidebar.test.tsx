import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores/vehicles.store', () => ({
  useVehiclesStore: vi.fn(),
}))

vi.mock('./SidebarGoogleAuthSection', () => ({
  default: () => <div data-testid="google-auth-section" />,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSidebar(open = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <Sidebar open={open} onClose={onClose} />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('visibility', () => {
    it('renders the panel translated offscreen when closed', () => {
      renderSidebar(false)
      const panel = screen.getByRole('complementary')
      expect(panel.className).toContain('-translate-x-full')
    })

    it('renders the panel in-view when open', () => {
      renderSidebar(true)
      const panel = screen.getByRole('complementary')
      expect(panel.className).toContain('translate-x-0')
    })

    it('renders a backdrop overlay when open', () => {
      renderSidebar(true)
      // backdrop is a div that sits behind the panel
      expect(document.querySelector('.bg-black\\/30')).not.toBeNull()
    })

    it('does not render a backdrop overlay when closed', () => {
      renderSidebar(false)
      expect(document.querySelector('.bg-black\\/30')).toBeNull()
    })
  })

  describe('close interactions', () => {
    it('calls onClose when the X button is clicked', () => {
      const onClose = vi.fn()
      renderSidebar(true, onClose)
      onClose.mockClear() // clear the call from the initial pathname-change useEffect
      fireEvent.click(screen.getByRole('button'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when the backdrop is clicked', () => {
      const onClose = vi.fn()
      renderSidebar(true, onClose)
      onClose.mockClear() // clear the call from the initial pathname-change useEffect
      const backdrop = document.querySelector('.bg-black\\/30') as Element
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('main navigation section', () => {
    it('renders the main section heading', () => {
      renderSidebar()
      expect(screen.getByText('sidebar.main')).toBeInTheDocument()
    })

    it('renders all main nav links', () => {
      renderSidebar()
      expect(screen.getByText('nav.dashboard')).toBeInTheDocument()
      expect(screen.getByText('nav.transactions')).toBeInTheDocument()
      expect(screen.getByText('nav.vehicles')).toBeInTheDocument()
      expect(screen.getByText('nav.balanceSheet')).toBeInTheDocument()
      expect(screen.getByText('nav.reports')).toBeInTheDocument()
      expect(screen.getByText('nav.budgets')).toBeInTheDocument()
      expect(screen.getByText('nav.insights')).toBeInTheDocument()
      expect(screen.getByText('nav.reminders')).toBeInTheDocument()
      expect(screen.getByText('nav.compoundInterest')).toBeInTheDocument()
    })
  })

  describe('data section', () => {
    it('renders the data section heading', () => {
      renderSidebar()
      expect(screen.getByText('sidebar.data')).toBeInTheDocument()
    })

    it('renders the Import & Export link', () => {
      renderSidebar()
      const link = screen.getByText('settings.importExportTitle')
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/settings/import-export')
    })

    it('renders the Google Drive Sync link', () => {
      renderSidebar()
      const link = screen.getByText('settings.googleDriveTitle')
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/settings/google-drive')
    })
  })

  describe('settings section', () => {
    it('renders the settings section heading', () => {
      renderSidebar()
      expect(screen.getByText('sidebar.settings')).toBeInTheDocument()
    })

    it('renders all settings nav links', () => {
      renderSidebar()
      expect(screen.getByText('settings.accounts')).toBeInTheDocument()
      expect(screen.getByText('settings.categories')).toBeInTheDocument()
      expect(screen.getByText('settings.labels')).toBeInTheDocument()
      expect(screen.getByText('settings.exchangeRates')).toBeInTheDocument()
      expect(screen.getByText('nav.settings')).toBeInTheDocument()
    })
  })

  describe('google auth section', () => {
    it('renders the google auth section', () => {
      renderSidebar()
      expect(screen.getByTestId('google-auth-section')).toBeInTheDocument()
    })
  })
})
