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