import { endOfMonth, endOfQuarter, endOfWeek, endOfYear, isAfter, subMonths, subQuarters, subWeeks, subYears } from 'date-fns'

import { convertToBase } from '@/lib/currency'
import type { Account, Transaction } from '@/types'

export type BalanceSheetPreset =
  | 'endLastWeek'
  | 'endLast2Weeks'
  | 'endLastMonth'
  | 'sameTimeLastMonth'
  | 'endLastQuarter'
  | 'endLastYear'
  | 'sameTimeLastYear'
  | 'endOfThisMonth'

export const BALANCE_SHEET_PRESETS: BalanceSheetPreset[] = [
  'endLastWeek',
  'endLast2Weeks',
  'endLastMonth',
  'sameTimeLastMonth',
  'endLastQuarter',
  'endLastYear',
  'sameTimeLastYear',
  'endOfThisMonth',
]

export function getComparisonDate(preset: BalanceSheetPreset, now = new Date()): Date {
  switch (preset) {
    case 'endLastWeek':
      return endOfWeek(subWeeks(now, 1))
    case 'endLast2Weeks':
      return endOfWeek(subWeeks(now, 2))
    case 'endLastMonth':
      return endOfMonth(subMonths(now, 1))
    case 'sameTimeLastMonth':
      return subMonths(now, 1)
    case 'endLastQuarter':
      return endOfQuarter(subQuarters(now, 1))
    case 'endLastYear':
      return endOfYear(subYears(now, 1))
    case 'sameTimeLastYear':
      return subYears(now, 1)
    case 'endOfThisMonth':
      return endOfMonth(now)
  }
}

export function getAccountTransactionAmount(transaction: Transaction, account: Account): number {
  if (transaction.type === 'income' && transaction.accountId === account.id) {
    return transaction.amount
  }

  if (transaction.type === 'expense' && transaction.accountId === account.id) {
    return -transaction.amount
  }

  if (transaction.type === 'transfer') {
    if (transaction.accountId === account.id) {
      return -transaction.amount
    }

    if (transaction.toAccountId === account.id) {
      return transaction.originalAmount ?? transaction.amount
    }
  }

  return 0
}

export function isTransactionForAccount(transaction: Transaction, accountId: string): boolean {
  return transaction.accountId === accountId || transaction.toAccountId === accountId
}

export function getAccountBalanceAtDate(
  account: Account,
  transactions: Transaction[],
  at: Date,
): number {
  const movement = transactions.reduce((sum, transaction) => {
    const transactionDate = new Date(transaction.date)
    if (isAfter(transactionDate, at)) {
      return sum
    }

    return sum + getAccountTransactionAmount(transaction, account)
  }, 0)

  return account.openingBalance + movement
}

export function convertBalanceToBase(
  balance: number,
  currency: string,
  baseCurrency: string,
  getRateForPair: (from: string, to: string) => number | null,
): number | null {
  if (currency === baseCurrency) {
    return balance
  }

  const rate = getRateForPair(currency, baseCurrency)
  if (rate === null) {
    return null
  }

  return convertToBase(balance, rate)
}

// ── Centralized balance computation ───────────────────────────────────────────

/** Balance shown next to a transaction, in each involved account's currency. */
export interface AccountRunningBalance {
  accountBalance: number
  accountCurrency: string
  toAccountBalance?: number
  toAccountCurrency?: string
}

export interface BuildRunningBalanceOptions {
  /**
   * When true, also records an entry for incoming transfers (where the account
   * is the transfer destination). Single-account views (e.g. account detail)
   * want every transaction row keyed under its own transaction id.
   * Multi-account lists pass false so each transaction is recorded once, from
   * its source account's perspective.
   */
  includeIncoming?: boolean
}

/**
 * Computes the balance of every account at `at`, using the same
 * getAccountBalanceAtDate logic everywhere. Cancelled transactions must already
 * be filtered out by the caller.
 */
export function buildAccountBalanceMap(
  accounts: Account[],
  transactions: Transaction[],
  at: Date = new Date(),
): Map<string, number> {
  const map = new Map<string, number>()
  for (const account of accounts) {
    const accountTxns = transactions.filter((tx) => isTransactionForAccount(tx, account.id))
    map.set(account.id, getAccountBalanceAtDate(account, accountTxns, at))
  }
  return map
}

/**
 * Builds the running ("latest") balance after each transaction of a single
 * account. `accountTransactions` must be newest-first; the walk starts at
 * `currentBalance` and steps backwards, so the most recent row always equals the
 * account's current balance. `allTransactions` is used to resolve the
 * counterpart account's balance for transfers.
 */
export function buildAccountRunningBalanceMap(
  account: Account,
  accountTransactions: Transaction[],
  allTransactions: Transaction[],
  currentBalance: number,
  accountMap: Map<string, Account>,
  options: BuildRunningBalanceOptions = {},
): Map<string, AccountRunningBalance> {
  const result = new Map<string, AccountRunningBalance>()
  let running = currentBalance

  for (const tx of accountTransactions) {
    const recordFromSource = tx.accountId === account.id
    const shouldRecord = recordFromSource || options.includeIncoming === true

    if (shouldRecord) {
      const entry: AccountRunningBalance = {
        accountBalance: running,
        accountCurrency: account.currency,
      }

      if (tx.type === 'transfer') {
        const counterpartId = recordFromSource ? tx.toAccountId : tx.accountId
        const counterpartAcc = counterpartId ? accountMap.get(counterpartId) : undefined
        if (counterpartAcc) {
          const counterpartTxns = allTransactions.filter((t) => isTransactionForAccount(t, counterpartAcc.id))
          entry.toAccountBalance = getAccountBalanceAtDate(counterpartAcc, counterpartTxns, new Date(tx.date))
          entry.toAccountCurrency = counterpartAcc.currency
        }
      }

      result.set(tx.id, entry)
    }

    // Undo this tx's effect to step back to the balance before it
    if (tx.type === 'income') {
      running -= tx.amount
    } else if (tx.type === 'expense') {
      running += tx.amount
    } else if (tx.type === 'transfer') {
      if (recordFromSource) {
        running += tx.amount // undo debit from source
      } else {
        running -= (tx.originalAmount ?? tx.amount) // undo credit to destination
      }
    }
  }

  return result
}