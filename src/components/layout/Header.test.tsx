import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from './Header'

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockPathname = '/'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useLocation: () => ({ pathname: mockPathname }),
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderHeader(onMenuToggle = vi.fn()) {
  return render(
    <MemoryRouter>
      <Header onMenuToggle={onMenuToggle} />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = '/'
  })

  describe('menu button', () => {
    it('renders the menu button', () => {
      renderHeader()
      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
    })

    it('calls onMenuToggle when the menu button is clicked', () => {
      const onMenuToggle = vi.fn()
      renderHeader(onMenuToggle)
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
      expect(onMenuToggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('title derivation from pathname', () => {
    const cases: Array<[string, string]> = [
      ['/', 'nav.dashboard'],
      ['/transactions', 'nav.transactions'],
      ['/balance-sheet', 'balanceSheet.title'],
      ['/vehicles', 'nav.vehicles'],
      ['/reports', 'nav.reports'],
      ['/budgets', 'nav.budgets'],
      ['/insights', 'nav.insights'],
      ['/settings', 'nav.settings'],
      ['/settings/accounts', 'settings.accounts'],
      ['/settings/categories', 'settings.categories'],
      ['/settings/labels', 'settings.labels'],
      ['/settings/exchange-rates', 'settings.exchangeRates'],
      ['/settings/import-export', 'settings.importExportTitle'],
      ['/settings/google-drive', 'settings.googleDriveTitle'],
      ['/settings/data-retention', 'settings.dataRetentionTitle'],
      ['/settings/preferences', 'settings.preferencesTitle'],
    ]

    it.each(cases)('pathname "%s" → title key "%s"', (pathname, expectedKey) => {
      mockPathname = pathname
      renderHeader()
      expect(screen.getByText(expectedKey)).toBeInTheDocument()
    })

    it('balance-sheet sub-route uses the detail title (longest prefix wins)', () => {
      mockPathname = '/balance-sheet/acc-1'
      renderHeader()
      expect(screen.getByText('balanceSheet.detailTitle')).toBeInTheDocument()
    })

    it('unknown route falls back to "ExpenseTracking"', () => {
      mockPathname = '/unknown/route'
      renderHeader()
      expect(screen.getByText('ExpenseTracking')).toBeInTheDocument()
    })
  })

  describe('title link', () => {
    it('renders the title as a link pointing to /', () => {
      renderHeader()
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/')
    })
  })
})
