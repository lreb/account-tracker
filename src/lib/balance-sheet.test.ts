import { describe, it, expect } from 'vitest'

import {
  buildAccountBalanceMap,
  buildAccountRunningBalanceMap,
} from '@/lib/balance-sheet'
import type { Account, Transaction } from '@/types'

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _id = 0

function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>,
): Transaction {
  return {
    id:          `tx-${++_id}`,
    status:      'cleared',
    accountId:   'acc1',
    toAccountId: undefined,
    categoryId:  'cat1',
    currency:    'USD',
    description: 'Test transaction',
    labels:      [],
    ...overrides,
  }
}

const ACC1: Account = {
  id:             'acc1',
  name:           'Checking',
  type:           'asset',
  openingBalance: 1000,
  currency:       'USD',
}

const ACC2: Account = {
  id:             'acc2',
  name:           'Savings',
  type:           'asset',
  openingBalance: 2000,
  currency:       'USD',
}

const ACC3: Account = {
  id:             'acc3',
  name:           'EUR Wallet',
  type:           'asset',
  openingBalance: 0,
  currency:       'EUR',
}

function accountMap(): Map<string, Account> {
  return new Map([ACC1, ACC2, ACC3].map((a) => [a.id, a]))
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const income = makeTx({
  type: 'income',
  amount: 500,
  date: '2026-01-01T00:00:00.000Z',
  accountId: 'acc1',
})

const expense = makeTx({
  type: 'expense',
  amount: 200,
  date: '2026-01-05T00:00:00.000Z',
  accountId: 'acc1',
})

const transferOut = makeTx({
  type: 'transfer',
  amount: 300,
  date: '2026-01-10T00:00:00.000Z',
  accountId: 'acc1',
  toAccountId: 'acc2',
})

const crossTransfer = makeTx({
  type: 'transfer',
  amount: 400,
  date: '2026-01-15T00:00:00.000Z',
  accountId: 'acc1',
  toAccountId: 'acc3',
  currency: 'USD',
  originalAmount: 350, // destination (acc3) currency: EUR cents
  originalCurrency: 'EUR',
})

const futureIncome = makeTx({
  type: 'income',
  amount: 500,
  date: '2026-08-01T00:00:00.000Z',
  accountId: 'acc1',
})

const AT = new Date('2026-02-01T00:00:00.000Z')

// ─── buildAccountBalanceMap ───────────────────────────────────────────────────

describe('buildAccountBalanceMap', () => {
  it('returns opening balances when there are no transactions', () => {
    const balances = buildAccountBalanceMap([ACC1, ACC2, ACC3], [], AT)
    expect(balances.get('acc1')).toBe(1000)
    expect(balances.get('acc2')).toBe(2000)
    expect(balances.get('acc3')).toBe(0)
  })

  it('computes the balance of every account at the given date', () => {
    const balances = buildAccountBalanceMap(
      [ACC1, ACC2, ACC3],
      [income, expense, transferOut, crossTransfer, futureIncome],
      AT,
    )

    // acc1: 1000 + 500 − 200 − 300 − 400
    expect(balances.get('acc1')).toBe(600)
    // acc2: 2000 + 300 (received transfer)
    expect(balances.get('acc2')).toBe(2300)
    // acc3: 0 + 350 (received cross-currency transfer, dest currency)
    expect(balances.get('acc3')).toBe(350)
  })

  it('ignores transactions dated after the reference date', () => {
    const balances = buildAccountBalanceMap([ACC1], [futureIncome], AT)
    expect(balances.get('acc1')).toBe(1000)
  })
})

// ─── buildAccountRunningBalanceMap ────────────────────────────────────────────

describe('buildAccountRunningBalanceMap', () => {
  // acc1's transactions, newest-first, with the final balance from the map test.
  const acc1Txns = [crossTransfer, transferOut, expense, income]
  const currentBalance = 600

  it('walks from the current balance so the first (newest) row matches it', () => {
    const result = buildAccountRunningBalanceMap(
      ACC1,
      acc1Txns,
      [...acc1Txns],
      currentBalance,
      accountMap(),
    )

    expect(result.get(crossTransfer.id)?.accountBalance).toBe(600)
    expect(result.get(transferOut.id)?.accountBalance).toBe(1000)
    expect(result.get(expense.id)?.accountBalance).toBe(1300)
    expect(result.get(income.id)?.accountBalance).toBe(1500)
  })

  it('records transfer counterpart balances in their own currency', () => {
    const result = buildAccountRunningBalanceMap(
      ACC1,
      acc1Txns,
      [...acc1Txns],
      currentBalance,
      accountMap(),
    )

    expect(result.get(crossTransfer.id)).toEqual({
      accountBalance:   600,
      accountCurrency:  'USD',
      toAccountBalance: 350,
      toAccountCurrency: 'EUR',
    })
    expect(result.get(transferOut.id)).toEqual({
      accountBalance:   1000,
      accountCurrency:  'USD',
      toAccountBalance: 2300,
      toAccountCurrency: 'USD',
    })
  })

  it('skips incoming transfers by default (multi-account list behavior)', () => {
    const result = buildAccountRunningBalanceMap(
      ACC2,
      [transferOut],
      [transferOut],
      2300,
      accountMap(),
    )

    expect(result.size).toBe(0)
  })

  it('records incoming transfers when includeIncoming is true (detail view)', () => {
    const result = buildAccountRunningBalanceMap(
      ACC2,
      [transferOut],
      [transferOut],
      2300,
      accountMap(),
      { includeIncoming: true },
    )

    expect(result.get(transferOut.id)).toEqual({
      accountBalance: 2300,
      accountCurrency: 'USD',
      toAccountBalance: 700,
      toAccountCurrency: 'USD',
    })
  })

  it('returns an empty map when there are no transactions', () => {
    const result = buildAccountRunningBalanceMap(ACC1, [], [], 1000, accountMap())
    expect(result.size).toBe(0)
  })
})