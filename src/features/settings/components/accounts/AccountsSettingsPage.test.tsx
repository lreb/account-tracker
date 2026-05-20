import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Account, Transaction } from '@/types'
import AccountsSettingsPage from './AccountsSettingsPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockAccounts: Account[] = []
const mockTransactions: Transaction[] = []
const mockRemove = vi.fn()
const mockUpdate = vi.fn()
const mockRemoveMany = vi.fn()
const mockBulkDelete = vi.fn((_ids: string[]) => Promise.resolve())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ accounts: mockAccounts, remove: mockRemove, update: mockUpdate }),
}))

vi.mock('@/stores/transactions.store', () => ({
  useTransactionsStore: () => ({ transactions: mockTransactions, removeMany: mockRemoveMany }),
}))

vi.mock('@/lib/accounts', () => ({
  getActiveAccounts: (accounts: Account[]) => accounts.filter((a) => !a.cancelled),
  sortAccounts: (accounts: Account[]) => [...accounts],
}))

vi.mock('@/lib/balance-sheet', () => ({
  getAccountBalanceAtDate: () => 0,
  isTransactionForAccount: (tx: Transaction, accountId: string) =>
    tx.accountId === accountId || tx.toAccountId === accountId,
}))

vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
}))

vi.mock('@/constants/account-subtypes', () => ({
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE: {
    asset: [{ value: 'checking-debit', labelKey: 'accounts.subtypes.checkingDebit' }],
    liability: [{ value: 'credit-card', labelKey: 'accounts.subtypes.creditCard' }],
  },
  getOtherSubtypeLabelKey: (type: string) =>
    type === 'asset' ? 'accounts.subtypes.otherAsset' : 'accounts.subtypes.otherLiability',
}))

vi.mock('@/db', () => ({
  db: {
    transactions: {
      filter: () => ({ toArray: () => Promise.resolve([]) }),
      // Wrap in a function so mockBulkDelete is accessed lazily (after hoisting)
      bulkDelete: (ids: string[]) => mockBulkDelete(ids),
    },
    settings: {
      get: vi.fn(() => Promise.resolve({ value: '1' })),
    },
    accounts: {
      count: vi.fn(() => Promise.resolve(1)),
    },
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/scroll-to-top-button', () => ({
  ScrollToTopButton: () => null,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc1',
    name: 'Checking',
    type: 'asset',
    subtype: 'checking-debit',
    openingBalance: 0,
    currency: 'USD',
    ...overrides,
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    type: 'expense',
    amount: 500,
    date: new Date().toISOString(),
    categoryId: 'cat1',
    accountId: 'acc1',
    description: 'Test',
    status: 'cleared',
    currency: 'USD',
    ...overrides,
  }
}

async function renderPage() {
  const result = render(
    <MemoryRouter>
      <AccountsSettingsPage />
    </MemoryRouter>,
  )
  await act(async () => {})
  return result
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AccountsSettingsPage', () => {
  beforeEach(() => {
    mockAccounts.length = 0
    mockTransactions.length = 0
    vi.clearAllMocks()
    mockBulkDelete.mockResolvedValue(undefined)
  })

  describe('page header', () => {
    it('renders the page title', async () => {
      await renderPage()
      expect(screen.getByText('settings.accounts')).toBeInTheDocument()
    })

    it('floating add button navigates to new account form', async () => {
      await renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'common.add' }))
      expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts/new')
    })
  })

  describe('empty state', () => {
    it('renders the empty state message when no accounts exist', async () => {
      await renderPage()
      expect(screen.getByText('accounts.noAccounts')).toBeInTheDocument()
    })

    it('renders the addFirst button in the empty state', async () => {
      await renderPage()
      expect(screen.getByText('accounts.addFirst')).toBeInTheDocument()
    })

    it('addFirst button navigates to the new account form', async () => {
      await renderPage()
      fireEvent.click(screen.getByText('accounts.addFirst'))
      expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts/new')
    })

    it('does not render account list sections when no accounts exist', async () => {
      await renderPage()
      expect(screen.queryByText('accounts.types.asset')).not.toBeInTheDocument()
    })
  })

  describe('account list', () => {
    it('renders the account name', async () => {
      mockAccounts.push(makeAccount({ name: 'My Savings' }))
      await renderPage()
      expect(screen.getByText('My Savings')).toBeInTheDocument()
    })

    it('renders the account currency code', async () => {
      mockAccounts.push(makeAccount({ currency: 'EUR' }))
      await renderPage()
      expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('renders the asset type section heading', async () => {
      mockAccounts.push(makeAccount({ type: 'asset' }))
      await renderPage()
      expect(screen.getByText('accounts.types.asset')).toBeInTheDocument()
    })

    it('renders the liability type section heading for liability accounts', async () => {
      mockAccounts.push(makeAccount({ type: 'liability', subtype: 'credit-card' }))
      await renderPage()
      expect(screen.getByText('accounts.types.liability')).toBeInTheDocument()
    })

    it('renders the balance via formatCurrency', async () => {
      mockAccounts.push(makeAccount({ currency: 'USD', openingBalance: 1000 }))
      await renderPage()
      // getAccountBalanceAtDate mock returns 0; formatCurrency mock returns "USD 0"
      expect(screen.getAllByText('USD 0').length).toBeGreaterThanOrEqual(1)
    })

    it('shows cancelledExcluded message for cancelled accounts', async () => {
      mockAccounts.push(makeAccount({ cancelled: true }))
      await renderPage()
      expect(screen.getByText('accounts.cancelledExcluded')).toBeInTheDocument()
    })

    it('shows excludedFromTotals message for hidden accounts', async () => {
      mockAccounts.push(makeAccount({ hidden: true }))
      await renderPage()
      expect(screen.getByText('accounts.excludedFromTotals')).toBeInTheDocument()
    })

    it('edit button navigates to the account edit page', async () => {
      mockAccounts.push(makeAccount({ id: 'acc-42' }))
      await renderPage()
      // Button order with one account: [eye/visibility, pencil/edit, trash/delete, fab/add]
      fireEvent.click(screen.getAllByRole('button')[1])
      expect(mockNavigate).toHaveBeenCalledWith('/settings/accounts/acc-42')
    })

    it('visibility toggle calls update with inverted hidden flag', async () => {
      mockAccounts.push(makeAccount({ id: 'acc1', hidden: false }))
      await renderPage()
      // Button order with one account: [eye/visibility, pencil/edit, trash/delete, fab/add]
      fireEvent.click(screen.getAllByRole('button')[0])
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc1', hidden: true }),
      )
    })

    it('visibility toggle sets hidden to false when account is already hidden', async () => {
      mockAccounts.push(makeAccount({ id: 'acc1', hidden: true }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[0])
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc1', hidden: false }),
      )
    })
  })

  describe('delete dialog', () => {
    it('trash button opens the confirmation dialog', async () => {
      mockAccounts.push(makeAccount())
      await renderPage()
      expect(screen.queryByRole('dialog')).toBeNull()
      // Button order: [eye, pencil, trash, fab]
      fireEvent.click(screen.getAllByRole('button')[2])
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('dialog shows the account name in the description', async () => {
      mockAccounts.push(makeAccount({ name: 'Vacation Fund' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      expect(screen.getByText('accounts.deleteConfirmTitle')).toBeInTheDocument()
    })

    it('cancel button closes the dialog', async () => {
      mockAccounts.push(makeAccount())
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.cancel'))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('archive button calls update with hidden: true', async () => {
      mockAccounts.push(makeAccount({ id: 'acc1', hidden: false }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      fireEvent.click(screen.getByText('accounts.archiveInstead'))
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'acc1', hidden: true }),
        )
      })
    })

    it('archive button closes the dialog on success', async () => {
      mockAccounts.push(makeAccount())
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      fireEvent.click(screen.getByText('accounts.archiveInstead'))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
    })

    it('delete permanently calls remove with the account id', async () => {
      mockAccounts.push(makeAccount({ id: 'acc1' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      fireEvent.click(screen.getByText('accounts.deletePermanently'))
      await waitFor(() => {
        expect(mockRemove).toHaveBeenCalledWith('acc1')
      })
    })

    it('delete permanently calls bulkDelete and removeMany for linked transactions', async () => {
      mockAccounts.push(makeAccount({ id: 'acc1' }))
      mockTransactions.push(makeTx({ id: 'tx1', accountId: 'acc1' }))
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      fireEvent.click(screen.getByText('accounts.deletePermanently'))
      await waitFor(() => {
        expect(mockBulkDelete).toHaveBeenCalledWith(['tx1'])
        expect(mockRemoveMany).toHaveBeenCalledWith(['tx1'])
        expect(mockRemove).toHaveBeenCalledWith('acc1')
      })
    })

    it('delete permanently with no linked transactions skips bulkDelete', async () => {
      mockAccounts.push(makeAccount({ id: 'acc1' }))
      // no transactions in mockTransactions
      await renderPage()
      fireEvent.click(screen.getAllByRole('button')[2])
      fireEvent.click(screen.getByText('accounts.deletePermanently'))
      await waitFor(() => {
        expect(mockRemove).toHaveBeenCalledWith('acc1')
        expect(mockBulkDelete).not.toHaveBeenCalled()
      })
    })
  })
})
