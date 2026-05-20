import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { RecurringTransaction, Account } from '@/types'

// ─── Mutable mock state ───────────────────────────────────────────────────────

const mockRecurringTransactions: RecurringTransaction[] = []
const mockAccounts: Account[] = []
const mockLoad = vi.fn()
const mockUpdateReminder = vi.fn()
const mockAddTransaction = vi.fn()
const mockNavigate = vi.fn()

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/stores/recurring-transactions.store', () => ({
  useRecurringTransactionsStore: () => ({
    recurringTransactions: mockRecurringTransactions,
    load: mockLoad,
    update: mockUpdateReminder,
  }),
}))

vi.mock('@/stores/transactions.store', () => ({
  useTransactionsStore: () => ({
    add: mockAddTransaction,
  }),
}))

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({
    accounts: mockAccounts,
  }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    baseCurrency: 'USD',
  }),
}))

vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
}))

// ─── Import under test (after mocks) ─────────────────────────────────────────

import DueRemindersSection from './DueRemindersSection'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReminder(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 'r1',
    type: 'expense',
    amount: 5000,
    categoryId: 'cat1',
    accountId: 'acc1',
    description: 'Netflix',
    notes: undefined,
    status: 'pending',
    labels: [],
    currency: 'USD',
    exchangeRate: undefined,
    interval: 'monthly',
    startDate: '2025-01-01',
    time: '09:00',
    totalOccurrences: 12,
    occurrencesFired: 2,
    nextDueDate: '2020-01-01', // past date — always due
    createdAt: '2025-01-01T00:00:00.000Z',
    active: true,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DueRemindersSection', () => {
  beforeEach(() => {
    mockRecurringTransactions.length = 0
    mockAccounts.length = 0
    vi.clearAllMocks()
    mockLoad.mockResolvedValue(undefined)
    mockUpdateReminder.mockResolvedValue(undefined)
    mockAddTransaction.mockResolvedValue(undefined)
  })

  it('returns null when there are no recurring transactions', () => {
    const { container } = render(<DueRemindersSection />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when all items are future-dated (not yet due)', () => {
    mockRecurringTransactions.push(makeReminder({ nextDueDate: '2099-01-01' }))
    const { container } = render(<DueRemindersSection />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when items are inactive', () => {
    mockRecurringTransactions.push(makeReminder({ active: false, nextDueDate: '2020-01-01' }))
    const { container } = render(<DueRemindersSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the amber banner when due items exist', () => {
    mockRecurringTransactions.push(makeReminder())
    render(<DueRemindersSection />)
    expect(screen.getByText('reminders.dueRemindersTitle')).toBeInTheDocument()
  })

  it('renders the description of the due item', () => {
    mockRecurringTransactions.push(makeReminder({ description: 'Monthly Rent' }))
    render(<DueRemindersSection />)
    expect(screen.getByText('Monthly Rent')).toBeInTheDocument()
  })

  it('renders remaining occurrences info in sub-line', () => {
    mockRecurringTransactions.push(makeReminder({ totalOccurrences: 12, occurrencesFired: 2 }))
    render(<DueRemindersSection />)
    expect(screen.getByText(/reminders\.remainingOccurrences/)).toBeInTheDocument()
  })

  it('"view all" button navigates to /reminders', () => {
    mockRecurringTransactions.push(makeReminder())
    render(<DueRemindersSection />)
    fireEvent.click(screen.getByRole('button', { name: 'reminders.viewAll' }))
    expect(mockNavigate).toHaveBeenCalledWith('/reminders')
  })

  it('calls load on mount', () => {
    render(<DueRemindersSection />)
    expect(mockLoad).toHaveBeenCalled()
  })

  it('skip button calls updateReminder with incremented occurrencesFired', async () => {
    const r = makeReminder({ id: 'r1', occurrencesFired: 2, totalOccurrences: 12 })
    mockRecurringTransactions.push(r)
    render(<DueRemindersSection />)

    fireEvent.click(screen.getByLabelText('reminders.skip'))

    await waitFor(() => {
      expect(mockUpdateReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r1', occurrencesFired: 3 }),
      )
    })
  })

  it('skip button does not call addTransaction', async () => {
    mockRecurringTransactions.push(makeReminder())
    render(<DueRemindersSection />)

    fireEvent.click(screen.getByLabelText('reminders.skip'))

    await waitFor(() => {
      expect(mockUpdateReminder).toHaveBeenCalled()
    })
    expect(mockAddTransaction).not.toHaveBeenCalled()
  })

  it('apply button calls both addTransaction and updateReminder', async () => {
    mockRecurringTransactions.push(makeReminder({ id: 'r1' }))
    render(<DueRemindersSection />)

    fireEvent.click(screen.getByRole('button', { name: /reminders\.apply/ }))

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalled()
      expect(mockUpdateReminder).toHaveBeenCalled()
    })
  })

  it('apply creates a transaction matching the reminder template', async () => {
    const r = makeReminder({ id: 'r1', amount: 9900, currency: 'EUR', description: 'Gym' })
    mockRecurringTransactions.push(r)
    render(<DueRemindersSection />)

    fireEvent.click(screen.getByRole('button', { name: /reminders\.apply/ }))

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9900,
          currency: 'EUR',
          description: 'Gym',
        }),
      )
    })
  })

  it('skipping the last occurrence sets active to false', async () => {
    const r = makeReminder({ id: 'r1', occurrencesFired: 11, totalOccurrences: 12 })
    mockRecurringTransactions.push(r)
    render(<DueRemindersSection />)

    fireEvent.click(screen.getByLabelText('reminders.skip'))

    await waitFor(() => {
      expect(mockUpdateReminder).toHaveBeenCalledWith(
        expect.objectContaining({ occurrencesFired: 12, active: false }),
      )
    })
  })

  it('applying the last occurrence sets active to false', async () => {
    const r = makeReminder({ id: 'r1', occurrencesFired: 11, totalOccurrences: 12 })
    mockRecurringTransactions.push(r)
    render(<DueRemindersSection />)

    fireEvent.click(screen.getByRole('button', { name: /reminders\.apply/ }))

    await waitFor(() => {
      expect(mockUpdateReminder).toHaveBeenCalledWith(
        expect.objectContaining({ occurrencesFired: 12, active: false }),
      )
    })
  })
})
