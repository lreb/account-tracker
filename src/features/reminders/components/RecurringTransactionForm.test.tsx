import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RecurringTransaction, Account, Label } from '@/types'

// ─── Mutable mock state ───────────────────────────────────────────────────────

const mockRecurringTransactions: RecurringTransaction[] = []
let mockLoading = false
let mockParams: Record<string, string> = {}
const mockNavigate = vi.fn()
const mockLoad = vi.fn()
const mockAdd = vi.fn()
const mockUpdate = vi.fn()

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@/stores/recurring-transactions.store', () => ({
  useRecurringTransactionsStore: () => ({
    recurringTransactions: mockRecurringTransactions,
    loading: mockLoading,
    load: mockLoad,
    add: mockAdd,
    update: mockUpdate,
  }),
}))

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ accounts: [] as Account[] }),
}))

vi.mock('@/stores/labels.store', () => ({
  useLabelsStore: () => ({ labels: [] as Label[], load: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('@/stores/exchange-rates.store', () => ({
  useExchangeRatesStore: () => ({ load: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    baseCurrency: 'USD',
    load: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/hooks/useTransactionCoreFields', () => ({
  useTransactionCoreFields: () => ({
    accounts: [],
    categories: [],
    visibleAccounts: [],
    sourceAccount: undefined,
    destAccount: undefined,
    isCrossCurrencyTransfer: false,
    filteredCategories: [],
    baseCurrency: 'USD',
  }),
}))

vi.mock('@/lib/accounts', () => ({
  getVisibleAccounts: (accounts: Account[]) => accounts,
  getAccountSelectOptions: () => [],
}))

vi.mock('@/components/ui/amount-calculator-button', () => ({
  AmountCalculatorButton: () => null,
}))

vi.mock('@/components/ui/label-picker-button', () => ({
  LabelPickerButton: () => null,
}))

vi.mock('@/components/ui/status-select', () => ({
  StatusSelect: () => null,
}))

vi.mock('@/components/ui/account-select', () => ({
  AccountSelect: () => null,
}))

vi.mock('@/components/ui/category-select', () => ({
  CategorySelect: () => null,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    type?: 'submit' | 'button' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input {...props} ref={ref} />,
  ),
}))

// ─── Import under test (after mocks) ─────────────────────────────────────────

import RecurringTransactionForm from './RecurringTransactionForm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExistingReminder(
  overrides: Partial<RecurringTransaction> = {},
): RecurringTransaction {
  return {
    id: 'r-edit',
    type: 'expense',
    amount: 5000,
    categoryId: 'cat1',
    accountId: 'acc1',
    description: 'Existing reminder',
    notes: '',
    status: 'pending',
    labels: [],
    currency: 'USD',
    exchangeRate: undefined,
    interval: 'monthly',
    startDate: '2025-01-01',
    time: '09:00',
    totalOccurrences: 12,
    occurrencesFired: 2,
    nextDueDate: '2025-06-01',
    createdAt: '2025-01-01T00:00:00.000Z',
    active: true,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecurringTransactionForm', () => {
  beforeEach(() => {
    mockRecurringTransactions.length = 0
    mockLoading = false
    mockParams = {}
    vi.clearAllMocks()
    mockLoad.mockResolvedValue(undefined)
    mockAdd.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
  })

  // ── Create mode (no id param) ────────────────────────────────────────────

  it('renders description input with placeholder', () => {
    render(<RecurringTransactionForm />)
    const input = screen.getByPlaceholderText('reminders.descriptionPlaceholder')
    expect(input).toBeInTheDocument()
  })

  it('renders the three transaction type buttons', () => {
    render(<RecurringTransactionForm />)
    expect(screen.getByRole('button', { name: 'transactions.expense' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'transactions.income' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'transactions.transfer' })).toBeInTheDocument()
  })

  it('renders all interval buttons', () => {
    render(<RecurringTransactionForm />)
    expect(screen.getByRole('button', { name: 'reminders.intervals.daily' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reminders.intervals.weekly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reminders.intervals.biweekly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reminders.intervals.monthly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reminders.intervals.yearly' })).toBeInTheDocument()
  })

  it('renders the schedule section heading', () => {
    render(<RecurringTransactionForm />)
    expect(screen.getByText('reminders.schedule')).toBeInTheDocument()
  })

  it('renders save and cancel buttons', () => {
    render(<RecurringTransactionForm />)
    expect(screen.getByRole('button', { name: 'common.save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument()
  })

  it('cancel button calls navigate(-1) when no returnTo param', () => {
    render(<RecurringTransactionForm />)
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('renders notes textarea', () => {
    render(<RecurringTransactionForm />)
    const notes = screen.getByPlaceholderText('transactions.notesPlaceholder')
    expect(notes).toBeInTheDocument()
  })

  it('renders amount input with placeholder 0.00', () => {
    render(<RecurringTransactionForm />)
    const amountInput = screen.getByPlaceholderText('0.00')
    expect(amountInput).toBeInTheDocument()
  })

  // ── Edit mode ────────────────────────────────────────────────────────────

  it('shows loading state when editing and store has not finished loading', () => {
    mockParams = { id: 'r-edit' }
    mockLoading = true
    // storeReady = !isEdit || length > 0 = false || false = false → loading state
    render(<RecurringTransactionForm />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('shows error when editing an id that does not exist in the store', () => {
    mockParams = { id: 'nonexistent' }
    mockLoading = false
    // Push a different item so storeReady becomes true (length > 0)
    mockRecurringTransactions.push(makeExistingReminder({ id: 'other-id' }))
    render(<RecurringTransactionForm />)
    expect(screen.getByText('common.error')).toBeInTheDocument()
  })

  it('pre-fills description when editing an existing reminder', () => {
    const existing = makeExistingReminder({ id: 'r-edit', description: 'Pre-filled desc' })
    mockParams = { id: 'r-edit' }
    mockLoading = false
    mockRecurringTransactions.push(existing)
    render(<RecurringTransactionForm />)
    const input = screen.getByPlaceholderText(
      'reminders.descriptionPlaceholder',
    ) as HTMLInputElement
    expect(input.value).toBe('Pre-filled desc')
  })
})
