import { describe, it, expect } from 'vitest'

import { buildStatementRows } from '@/lib/account-statement'
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

const ACCOUNT: Account = {
  id:             'acc1',
  name:           'Checking',
  type:           'asset',
  openingBalance: 0,
  currency:       'USD',
}

/** Returns a BalanceMapLike backed by a plain Map */
function balanceMap(entries: Record<string, number>): Map<string, { accountBalance: number }> {
  return new Map(Object.entries(entries).map(([k, v]) => [k, { accountBalance: v }]))
}

/** Returns a NamedMapLike backed by a plain Map */
function namedMap(entries: Record<string, string>): Map<string, { name: string }> {
  return new Map(Object.entries(entries).map(([k, v]) => [k, { name: v }]))
}

// ─── buildStatementRows ───────────────────────────────────────────────────────

describe('buildStatementRows', () => {
  it('returns an empty array when transactions list is empty', () => {
    const rows = buildStatementRows([], ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(rows).toHaveLength(0)
  })

  it('reverses input to oldest-first order (bank statement order)', () => {
    // Input is newest-first (as stored in Zustand)
    const txs = [
      makeTx({ type: 'expense', amount: 100, date: '2026-05-20T12:00:00.000Z', id: 'tx-new' }),
      makeTx({ type: 'expense', amount: 200, date: '2026-05-10T12:00:00.000Z', id: 'tx-old' }),
    ]
    const rows = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    // Oldest first in output
    expect(rows[0].description).toBe(txs[1].description)
    expect(rows[1].description).toBe(txs[0].description)
  })

  it('sets type to "Income" for income transactions on the account', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'income', amount: 5000, date: '2026-05-15T12:00:00.000Z' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.type).toBe('Income')
  })

  it('sets type to "Expense" for expense transactions on the account', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 3000, date: '2026-05-15T12:00:00.000Z' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.type).toBe('Expense')
  })

  it('sets type to "Transfer In" when account is the transfer destination', () => {
    const txs = [makeTx({
      id: 'tx-1', type: 'transfer', amount: 10000, date: '2026-05-15T12:00:00.000Z',
      accountId:   'acc2',  // source
      toAccountId: 'acc1',  // destination = our account
    })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.type).toBe('Transfer In')
  })

  it('sets type to "Transfer Out" when account is the transfer source', () => {
    const txs = [makeTx({
      id: 'tx-1', type: 'transfer', amount: 10000, date: '2026-05-15T12:00:00.000Z',
      accountId:   'acc1',  // source = our account
      toAccountId: 'acc2',  // destination
    })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.type).toBe('Transfer Out')
  })

  it('resolves category name from categoryMap', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z', categoryId: 'food' })]
    const [row] = buildStatementRows(
      txs, ACCOUNT, balanceMap({}),
      namedMap({ food: 'Food & Dining' }),
      namedMap({}),
    )
    expect(row.category).toBe('Food & Dining')
  })

  it('falls back to empty string when categoryId is not in categoryMap', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z', categoryId: 'unknown' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.category).toBe('')
  })

  it('resolves and joins multiple label names with semicolons', () => {
    const txs = [makeTx({
      id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z',
      labels: ['lbl-a', 'lbl-b'],
    })]
    const [row] = buildStatementRows(
      txs, ACCOUNT, balanceMap({}), namedMap({}),
      namedMap({ 'lbl-a': 'Vacation', 'lbl-b': 'Business' }),
    )
    expect(row.labels).toBe('Vacation; Business')
  })

  it('falls back to labelId string when label is not in labelMap', () => {
    const txs = [makeTx({
      id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z',
      labels: ['lbl-missing'],
    })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.labels).toBe('lbl-missing')
  })

  it('sets labels to empty string when transaction has no labels', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z', labels: [] })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.labels).toBe('')
  })

  it('reads running balance from balanceAfterTx map', () => {
    const txs = [makeTx({ id: 'tx-bal', type: 'income', amount: 5000, date: '2026-05-15T12:00:00.000Z' })]
    const [row] = buildStatementRows(
      txs, ACCOUNT,
      balanceMap({ 'tx-bal': 15000 }),
      namedMap({}), namedMap({}),
    )
    expect(row.balance).toBe(15000)
  })

  it('sets balance to undefined when transaction id is not in balanceAfterTx', () => {
    const txs = [makeTx({ id: 'tx-no-bal', type: 'income', amount: 5000, date: '2026-05-15T12:00:00.000Z' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.balance).toBeUndefined()
  })

  it('sets currency from the account, not the transaction', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'income', amount: 1000, date: '2026-05-15T12:00:00.000Z', currency: 'MXN' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.currency).toBe('USD') // ACCOUNT.currency
  })

  it('capitalizes the status field', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z', status: 'reconciled' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.status).toBe('Reconciled')
  })

  it('carries description and notes through unchanged', () => {
    const txs = [makeTx({
      id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z',
      description: 'Lunch at café',
      notes: 'With team',
    })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.description).toBe('Lunch at café')
    expect(row.notes).toBe('With team')
  })

  it('sets notes to empty string when transaction notes is undefined', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 500, date: '2026-05-15T12:00:00.000Z', notes: undefined })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.notes).toBe('')
  })

  it('signedAmount is positive for income', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'income', amount: 8000, date: '2026-05-15T12:00:00.000Z' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.signedAmount).toBe(8000)
  })

  it('signedAmount is negative for expense', () => {
    const txs = [makeTx({ id: 'tx-1', type: 'expense', amount: 8000, date: '2026-05-15T12:00:00.000Z' })]
    const [row] = buildStatementRows(txs, ACCOUNT, balanceMap({}), namedMap({}), namedMap({}))
    expect(row.signedAmount).toBe(-8000)
  })
})
