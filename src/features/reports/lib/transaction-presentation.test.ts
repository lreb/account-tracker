import { describe, it, expect, vi } from 'vitest'
import { getTransactionPresentation } from './transaction-presentation'
import type { Transaction, Account } from '@/types'

// ─── Mock getAccountTransactionAmount ────────────────────────────────────────

const mockGetAccountTransactionAmount = vi.fn<(tx: Transaction, acct: Account) => number>()

vi.mock('@/lib/balance-sheet', () => ({
  getAccountTransactionAmount: (tx: Transaction, acct: Account) =>
    mockGetAccountTransactionAmount(tx, acct),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const account: Account = {
  id: 'acct-1',
  name: 'Checking',
  type: 'asset',
  openingBalance: 0,
  currency: 'USD',
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 5000,
    date: '2026-05-15T12:00:00.000Z',
    categoryId: 'cat-1',
    accountId: 'acct-1',
    description: 'Test',
    status: 'cleared',
    currency: 'EUR',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getTransactionPresentation', () => {
  describe('income transaction', () => {
    it('prefix is "+" when signedAmount is positive', () => {
      mockGetAccountTransactionAmount.mockReturnValue(3000)
      const result = getTransactionPresentation(makeTx({ type: 'income' }), account)
      expect(result.prefix).toBe('+')
    })

    it('labelKey is transactions.income', () => {
      mockGetAccountTransactionAmount.mockReturnValue(3000)
      const result = getTransactionPresentation(makeTx({ type: 'income' }), account)
      expect(result.labelKey).toBe('transactions.income')
    })

    it('currency is the transaction currency (not account currency)', () => {
      mockGetAccountTransactionAmount.mockReturnValue(3000)
      const result = getTransactionPresentation(makeTx({ type: 'income', currency: 'EUR' }), account)
      expect(result.currency).toBe('EUR')
    })

    it('amount is the absolute value', () => {
      mockGetAccountTransactionAmount.mockReturnValue(3000)
      const result = getTransactionPresentation(makeTx({ type: 'income', amount: 3000 }), account)
      expect(result.amount).toBe(3000)
    })
  })

  describe('expense transaction', () => {
    it('prefix is "-" when signedAmount is negative', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-5000)
      const result = getTransactionPresentation(makeTx({ type: 'expense' }), account)
      expect(result.prefix).toBe('-')
    })

    it('labelKey is transactions.expense', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-5000)
      const result = getTransactionPresentation(makeTx({ type: 'expense' }), account)
      expect(result.labelKey).toBe('transactions.expense')
    })

    it('currency is the transaction currency', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-5000)
      const result = getTransactionPresentation(makeTx({ type: 'expense', currency: 'GBP' }), account)
      expect(result.currency).toBe('GBP')
    })

    it('amount is always positive (absolute value)', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-5000)
      const result = getTransactionPresentation(makeTx({ type: 'expense', amount: 5000 }), account)
      expect(result.amount).toBe(5000)
    })
  })

  describe('transfer — incoming (toAccountId === account.id)', () => {
    it('prefix is "+"', () => {
      mockGetAccountTransactionAmount.mockReturnValue(2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', toAccountId: 'acct-1', accountId: 'acct-2' }),
        account,
      )
      expect(result.prefix).toBe('+')
    })

    it('labelKey is balanceSheet.transactionKinds.transferIn', () => {
      mockGetAccountTransactionAmount.mockReturnValue(2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', toAccountId: 'acct-1', accountId: 'acct-2' }),
        account,
      )
      expect(result.labelKey).toBe('balanceSheet.transactionKinds.transferIn')
    })

    it('currency is the account currency (not transaction currency)', () => {
      mockGetAccountTransactionAmount.mockReturnValue(2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', toAccountId: 'acct-1', accountId: 'acct-2', currency: 'EUR' }),
        account,
      )
      expect(result.currency).toBe('USD') // account.currency
    })
  })

  describe('transfer — outgoing (accountId === account.id)', () => {
    it('prefix is "-"', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', accountId: 'acct-1', toAccountId: 'acct-3' }),
        account,
      )
      expect(result.prefix).toBe('-')
    })

    it('labelKey is balanceSheet.transactionKinds.transferOut', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', accountId: 'acct-1', toAccountId: 'acct-3' }),
        account,
      )
      expect(result.labelKey).toBe('balanceSheet.transactionKinds.transferOut')
    })

    it('currency is the account currency', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', accountId: 'acct-1', toAccountId: 'acct-3', currency: 'MXN' }),
        account,
      )
      expect(result.currency).toBe('USD') // account.currency
    })

    it('amount is always positive', () => {
      mockGetAccountTransactionAmount.mockReturnValue(-2000)
      const result = getTransactionPresentation(
        makeTx({ type: 'transfer', accountId: 'acct-1', toAccountId: 'acct-3', amount: 2000 }),
        account,
      )
      expect(result.amount).toBe(2000)
    })
  })
})
