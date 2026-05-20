import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RecurringTransaction, Account, Category } from '@/types'

// ─── Mutable mock state ───────────────────────────────────────────────────────

const mockRecurringTransactions: RecurringTransaction[] = []
const mockAccounts: Account[] = []
const mockCategories: Category[] = []
let mockLoading = false
const mockLoad = vi.fn()
const mockRemove = vi.fn()
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
    loading: mockLoading,
    load: mockLoad,
    remove: mockRemove,
  }),
}))

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ accounts: mockAccounts }),
}))

vi.mock('@/stores/categories.store', () => ({
  useCategoriesStore: () => ({ categories: mockCategories }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ baseCurrency: 'USD' }),
}))

vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
}))

vi.mock('@/lib/categories', () => ({
  getTranslatedCategoryName: () => 'TestCategory',
  sortCategories: (items: Category[]) => items,
}))

vi.mock('@/lib/icon-map', () => ({
  CategoryIcon: () => null,
}))

// ─── Import under test (after mocks) ─────────────────────────────────────────

import RemindersPage from './RemindersPage'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0

function makeReminder(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  idCounter++
  return {
    id: `r${idCounter}`,
    type: 'expense',
    amount: 5000,
    categoryId: 'cat1',
    accountId: 'acc1',
    description: `Reminder ${idCounter}`,
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
    nextDueDate: '2099-01-01', // future — not due by default
    createdAt: '2025-01-01T00:00:00.000Z',
    active: true,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RemindersPage', () => {
  beforeEach(() => {
    mockRecurringTransactions.length = 0
    mockAccounts.length = 0
    mockCategories.length = 0
    mockLoading = false
    idCounter = 0
    vi.clearAllMocks()
    mockLoad.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
  })

  it('shows loading state when loading is true', () => {
    mockLoading = true
    render(<RemindersPage />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('does not render main content while loading', () => {
    mockLoading = true
    render(<RemindersPage />)
    expect(screen.queryByText('reminders.title')).not.toBeInTheDocument()
  })

  it('renders page title when not loading', () => {
    render(<RemindersPage />)
    expect(screen.getByText('reminders.title')).toBeInTheDocument()
  })

  it('"new" button navigates to /reminders/new', () => {
    render(<RemindersPage />)
    fireEvent.click(screen.getByRole('button', { name: /reminders\.new/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/reminders/new')
  })

  it('shows empty state when no reminders exist', () => {
    render(<RemindersPage />)
    expect(screen.getByText('reminders.noReminders')).toBeInTheDocument()
  })

  it('empty state "create first" link navigates to /reminders/new', () => {
    render(<RemindersPage />)
    fireEvent.click(screen.getByRole('button', { name: 'reminders.createFirst' }))
    expect(mockNavigate).toHaveBeenCalledWith('/reminders/new')
  })

  it('calls load on mount', () => {
    render(<RemindersPage />)
    expect(mockLoad).toHaveBeenCalled()
  })

  it('shows the due section when overdue items exist', () => {
    mockRecurringTransactions.push(
      makeReminder({ nextDueDate: '2020-01-01' }), // past date → due
    )
    render(<RemindersPage />)
    expect(screen.getByText('reminders.sectionDue')).toBeInTheDocument()
  })

  it('shows the upcoming section for future active items', () => {
    mockRecurringTransactions.push(
      makeReminder({ nextDueDate: '2099-01-01' }), // future → upcoming
    )
    render(<RemindersPage />)
    expect(screen.getByText('reminders.sectionUpcoming')).toBeInTheDocument()
  })

  it('shows the completed section for fully-fired items', () => {
    mockRecurringTransactions.push(
      makeReminder({ occurrencesFired: 12, totalOccurrences: 12, active: false }),
    )
    render(<RemindersPage />)
    expect(screen.getByText('reminders.sectionCompleted')).toBeInTheDocument()
  })

  it('shows the paused section for inactive non-completed items', () => {
    mockRecurringTransactions.push(
      makeReminder({ active: false, occurrencesFired: 3, totalOccurrences: 12 }),
    )
    render(<RemindersPage />)
    expect(screen.getByText('reminders.sectionPaused')).toBeInTheDocument()
  })

  it('edit button navigates to /reminders/:id', () => {
    mockRecurringTransactions.push(makeReminder({ id: 'r-abc', nextDueDate: '2099-01-01' }))
    render(<RemindersPage />)
    fireEvent.click(screen.getByLabelText('common.edit'))
    expect(mockNavigate).toHaveBeenCalledWith('/reminders/r-abc')
  })

  it('delete button calls remove when user confirms', () => {
    mockRecurringTransactions.push(makeReminder({ id: 'r-del', nextDueDate: '2099-01-01' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RemindersPage />)

    fireEvent.click(screen.getByLabelText('common.delete'))

    expect(mockRemove).toHaveBeenCalledWith('r-del')
  })

  it('delete button does not call remove when user cancels', () => {
    mockRecurringTransactions.push(makeReminder({ id: 'r-del', nextDueDate: '2099-01-01' }))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RemindersPage />)

    fireEvent.click(screen.getByLabelText('common.delete'))

    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('renders the description of each reminder card', () => {
    mockRecurringTransactions.push(
      makeReminder({ description: 'Car Insurance', nextDueDate: '2099-01-01' }),
    )
    render(<RemindersPage />)
    expect(screen.getByText('Car Insurance')).toBeInTheDocument()
  })
})
