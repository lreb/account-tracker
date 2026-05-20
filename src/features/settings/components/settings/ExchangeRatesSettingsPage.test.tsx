import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ExchangeRate } from '@/types'
import ExchangeRatesSettingsPage from './ExchangeRatesSettingsPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRates: ExchangeRate[] = []
const mockRemove = vi.fn()
const mockFetchFromApi = vi.fn()
const mockAddManual = vi.fn()
const mockLoad = vi.fn()
let mockIsFetching = false

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores/exchange-rates.store', () => ({
  useExchangeRatesStore: () => ({
    rates: mockRates,
    isFetching: mockIsFetching,
    load: mockLoad,
    fetchFromApi: mockFetchFromApi,
    addManual: mockAddManual,
    remove: mockRemove,
  }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    baseCurrency: 'USD',
    load: vi.fn(),
  }),
}))

vi.mock('@/constants/currencies', () => ({
  EXCHANGE_RATE_CURRENCIES: ['USD', 'EUR', 'GBP'],
}))

vi.mock('@/components/ui/scroll-to-top-button', () => ({
  ScrollToTopButton: () => null,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: string
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: 'rate1',
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    rate: 1.085,
    date: '2026-01-01',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ExchangeRatesSettingsPage />
    </MemoryRouter>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExchangeRatesSettingsPage', () => {
  beforeEach(() => {
    mockRates.length = 0
    mockIsFetching = false
    vi.clearAllMocks()
  })

  describe('page header', () => {
    it('renders the page title', () => {
      renderPage()
      expect(screen.getByText('settings.exchangeRates')).toBeInTheDocument()
    })

    it('renders the fetch latest rates button', () => {
      renderPage()
      expect(screen.getByText('exchangeRates.fetchLatest')).toBeInTheDocument()
    })

    it('renders the add manually button', () => {
      renderPage()
      expect(screen.getByText('exchangeRates.addManual')).toBeInTheDocument()
    })

    it('does not show last updated when no rates exist', () => {
      renderPage()
      expect(screen.queryByText(/exchangeRates\.lastUpdated/)).toBeNull()
    })

    it('shows last updated date when rates exist', () => {
      mockRates.push(makeRate({ date: '2026-05-01' }))
      renderPage()
      expect(screen.getByText(/exchangeRates\.lastUpdated/)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders the empty state message when no rates exist', () => {
      renderPage()
      expect(screen.getByText('exchangeRates.noRates')).toBeInTheDocument()
    })

    it('does not render any rate row when the list is empty', () => {
      renderPage()
      expect(screen.queryByLabelText('common.delete')).toBeNull()
    })
  })

  describe('rates list', () => {
    it('renders the fromCurrency', () => {
      mockRates.push(makeRate({ fromCurrency: 'USD' }))
      renderPage()
      expect(screen.getByText('USD')).toBeInTheDocument()
    })

    it('renders the toCurrency', () => {
      mockRates.push(makeRate({ toCurrency: 'EUR' }))
      renderPage()
      expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('renders the rate value formatted to 4 decimal places', () => {
      mockRates.push(makeRate({ rate: 1.085 }))
      renderPage()
      expect(screen.getByText('1.0850')).toBeInTheDocument()
    })

    it('renders a delete button for each rate', () => {
      mockRates.push(makeRate())
      renderPage()
      expect(screen.getByLabelText('common.delete')).toBeInTheDocument()
    })

    it('does not render empty state when rates exist', () => {
      mockRates.push(makeRate())
      renderPage()
      expect(screen.queryByText('exchangeRates.noRates')).toBeNull()
    })
  })

  describe('fetch button', () => {
    it('calls fetchFromApi with baseCurrency when clicked', () => {
      renderPage()
      fireEvent.click(screen.getByText('exchangeRates.fetchLatest'))
      expect(mockFetchFromApi).toHaveBeenCalledWith('USD')
    })

    it('shows fetching label when isFetching is true', () => {
      mockIsFetching = true
      renderPage()
      expect(screen.getByText('exchangeRates.fetching')).toBeInTheDocument()
    })

    it('disables the fetch button while fetching', () => {
      mockIsFetching = true
      renderPage()
      expect(screen.getByText('exchangeRates.fetching')).toBeDisabled()
    })
  })

  describe('delete confirmation dialog', () => {
    it('trash button opens the delete confirmation dialog', () => {
      mockRates.push(makeRate())
      renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByLabelText('common.delete'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('dialog shows the delete confirmation title', () => {
      mockRates.push(makeRate())
      renderPage()
      fireEvent.click(screen.getByLabelText('common.delete'))
      expect(screen.getByText('exchangeRates.deleteConfirmTitle')).toBeInTheDocument()
    })

    it('dialog shows the data-override warning message', () => {
      mockRates.push(makeRate())
      renderPage()
      fireEvent.click(screen.getByLabelText('common.delete'))
      expect(screen.getByText('exchangeRates.deleteConfirmDesc')).toBeInTheDocument()
    })

    it('cancel button closes the dialog without calling remove', () => {
      mockRates.push(makeRate())
      renderPage()
      fireEvent.click(screen.getByLabelText('common.delete'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.cancel'))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('confirm delete calls remove with the correct rate id', () => {
      mockRates.push(makeRate({ id: 'rate-42' }))
      renderPage()
      fireEvent.click(screen.getByLabelText('common.delete'))
      fireEvent.click(screen.getByText('common.delete'))
      expect(mockRemove).toHaveBeenCalledWith('rate-42')
    })

    it('confirm delete closes the dialog', () => {
      mockRates.push(makeRate())
      renderPage()
      fireEvent.click(screen.getByLabelText('common.delete'))
      fireEvent.click(screen.getByText('common.delete'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('add manual rate dialog', () => {
    it('add manually button opens the add rate dialog', () => {
      renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByText('exchangeRates.addManual'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('dialog shows the add rate title', () => {
      renderPage()
      fireEvent.click(screen.getByText('exchangeRates.addManual'))
      expect(screen.getByText('exchangeRates.addRate')).toBeInTheDocument()
    })

    it('cancel button closes the add dialog', () => {
      renderPage()
      fireEvent.click(screen.getByText('exchangeRates.addManual'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.cancel'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('renders the rate input field', () => {
      renderPage()
      fireEvent.click(screen.getByText('exchangeRates.addManual'))
      expect(screen.getByPlaceholderText('1.0850')).toBeInTheDocument()
    })
  })
})
