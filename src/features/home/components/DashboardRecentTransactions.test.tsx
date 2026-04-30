import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardRecentTransactions } from './DashboardRecentTransactions'
import type { Transaction, Account, Category } from '@/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  ArrowRight: () => null,
}))

// ─── Test fixtures ─────────────────────────────────────────────────────────────

let _id = 0
beforeEach(() => { _id = 0 })

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${++_id}`,
    type: 'expense',
    amount: 5_000, // $50.00
    date: '2025-04-15T12:00:00.000Z',
    categoryId: 'food',
    accountId: 'acc1',
    description: 'Test transaction',
    status: 'cleared',
    currency: 'USD',
    ...overrides,
  }
}

const ACCOUNTS: Account[] = [
  { id: 'acc1', name: 'Checking', type: 'asset', openingBalance: 0, currency: 'USD' },
]

const CATEGORIES: Category[] = [
  { id: 'food', name: 'Food', icon: 'utensils', isCustom: false, type: 'expense' },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardRecentTransactions', () => {
  it('renders transaction description', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ description: 'Grocery run' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText('Grocery run')).toBeInTheDocument()
  })

  it('shows "−" prefix for expense transactions', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ type: 'expense', amount: 5_000 })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText(/^-/)).toBeInTheDocument()
  })

  it('shows "+" prefix for income transactions', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ type: 'income', amount: 10_000 })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText(/^\+/)).toBeInTheDocument()
  })

  it('shows no sign prefix for transfer transactions', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ type: 'transfer', toAccountId: 'acc2', amount: 5_000 })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    const amountEl = screen.getByText(/50\.00/)
    // textContent should start with "$" (currency symbol), not "+" or "-"
    expect(amountEl.textContent).toMatch(/^\$/)
    expect(amountEl.textContent).not.toMatch(/^[+-]/)
  })

  it('applies green text class for income', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ type: 'income' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    const amountEl = screen.getByText(/^\+/)
    expect(amountEl).toHaveClass('text-green-600')
  })

  it('applies red text class for expense', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ type: 'expense' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    const amountEl = screen.getByText(/^-/)
    expect(amountEl).toHaveClass('text-red-500')
  })

  it('applies gray text class for transfer', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ type: 'transfer', toAccountId: 'acc2' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    const amountEl = screen.getByText(/50\.00/)
    expect(amountEl).toHaveClass('text-gray-500')
  })

  it('resolves and shows category name in subtitle', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ categoryId: 'food' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText(/Food/)).toBeInTheDocument()
  })

  it('resolves and shows account name in subtitle', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ accountId: 'acc1' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText(/Checking/)).toBeInTheDocument()
  })

  it('falls back to "—" for unknown category', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ categoryId: 'unknown-cat' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })

  it('falls back to "—" for unknown account', () => {
    render(
      <DashboardRecentTransactions
        recent={[makeTx({ accountId: 'unknown-acc' })]}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />,
    )
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })

  it('renders empty list without crashing', () => {
    const { container } = render(
      <DashboardRecentTransactions recent={[]} accounts={[]} categories={[]} />,
    )
    expect(container.querySelector('ul')).toBeEmptyDOMElement()
  })

  it('renders a link to /transactions', () => {
    render(
      <DashboardRecentTransactions recent={[]} accounts={[]} categories={[]} />,
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/transactions')
  })

  it('renders all provided transactions', () => {
    const txs = [
      makeTx({ description: 'Groceries' }),
      makeTx({ description: 'Coffee' }),
      makeTx({ description: 'Rent' }),
    ]
    render(
      <DashboardRecentTransactions recent={txs} accounts={ACCOUNTS} categories={CATEGORIES} />,
    )
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Coffee')).toBeInTheDocument()
    expect(screen.getByText('Rent')).toBeInTheDocument()
  })
})
