import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ImportExportPage from './ImportExportPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/stores/transactions.store', () => ({
  useTransactionsStore: () => ({ transactions: [], load: vi.fn() }),
}))

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ accounts: [], load: vi.fn() }),
}))

vi.mock('@/stores/categories.store', () => ({
  useCategoriesStore: () => ({ categories: [], load: vi.fn() }),
}))

vi.mock('@/stores/labels.store', () => ({
  useLabelsStore: () => ({ labels: [], load: vi.fn() }),
}))

vi.mock('@/stores/budgets.store', () => ({
  useBudgetsStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/vehicles.store', () => ({
  useVehiclesStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    load: vi.fn(),
    saveSetting: vi.fn(),
    language: 'en',
    baseCurrency: 'USD',
  }),
}))

vi.mock('@/stores/exchange-rates.store', () => ({
  useExchangeRatesStore: () => ({ load: vi.fn() }),
}))

vi.mock('@/lib/csv', () => ({
  exportTransactionsCsv: vi.fn(),
  parseTransactionsCsv: vi.fn(() => ({
    imported: [],
    skipped: 0,
    errors: [],
    accountsToCreate: [],
    categoriesToCreate: [],
    labelsToCreate: [],
  })),
}))

vi.mock('@/lib/backup', () => ({
  buildFullBackup: vi.fn(() => Promise.resolve({})),
  downloadBackupFile: vi.fn(),
  parseBackupFile: vi.fn(() => ({})),
  restoreFromBackup: vi.fn(() => Promise.resolve()),
  resetApp: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/accounts', () => ({
  createDefaultAccount: vi.fn(() => ({ id: 'acc1', name: 'Cash', type: 'asset', openingBalance: 0, currency: 'USD' })),
}))

vi.mock('@/db', () => ({
  db: {
    accounts: { count: vi.fn(() => Promise.resolve(1)), bulkPut: vi.fn() },
    categories: { bulkPut: vi.fn() },
    labels: { bulkPut: vi.fn() },
    transactions: { bulkPut: vi.fn() },
    transaction: vi.fn((_mode, _tables, fn) => fn()),
  },
}))

vi.mock('@/i18n', () => ({ default: { changeLanguage: vi.fn() } }))

vi.mock('@/constants/currencies', () => ({
  COMMON_CURRENCIES: [{ code: 'USD', name: 'US Dollar' }],
}))

// Stub out Radix/shadcn components that rely on portals not available in jsdom
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <div data-onchange={String(onValueChange)}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <ImportExportPage />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ImportExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('page header', () => {
    it('renders the page title', () => {
      renderPage()
      expect(screen.getByText('settings.importExportTitle')).toBeInTheDocument()
    })

    it('back button navigates to /settings', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.back' }))
      expect(mockNavigate).toHaveBeenCalledWith('/settings')
    })
  })

  describe('CSV section', () => {
    it('renders the CSV section heading', () => {
      renderPage()
      expect(screen.getByText('settings.sectionCsv')).toBeInTheDocument()
    })

    it('renders the export data button', () => {
      renderPage()
      expect(screen.getByText('settings.exportData')).toBeInTheDocument()
    })

    it('renders the import data button', () => {
      renderPage()
      expect(screen.getByText('settings.importData')).toBeInTheDocument()
    })
  })

  describe('JSON backup section', () => {
    it('renders the backup section heading', () => {
      renderPage()
      expect(screen.getByText('settings.sectionBackup')).toBeInTheDocument()
    })

    it('renders the JSON export button', () => {
      renderPage()
      expect(screen.getByText('settings.jsonExport')).toBeInTheDocument()
    })

    it('renders the JSON restore button', () => {
      renderPage()
      expect(screen.getByText('settings.jsonRestore')).toBeInTheDocument()
    })
  })

  describe('danger zone', () => {
    it('renders the danger zone section heading', () => {
      renderPage()
      expect(screen.getByText('settings.sectionDanger')).toBeInTheDocument()
    })

    it('factory reset button opens confirmation dialog', () => {
      renderPage()
      // Dialog is closed initially
      expect(screen.queryByRole('dialog')).toBeNull()

      fireEvent.click(screen.getByText('settings.resetApp'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
