import { addDays, addHours, addMonths, isAfter, subDays, subMonths } from 'date-fns'
import { convertToBase } from '@/lib/currency'
import { getAccountBalanceAtDate } from '@/lib/balance-sheet'
import type { Account, Transaction } from '@/types'

export const ACCOUNT_PERFORMANCE_INTERVALS = [
  '1d', '1w', '2w', '1m', '1y', '3y', '5y', '10y',
] as const

export type AccountPerformanceInterval = typeof ACCOUNT_PERFORMANCE_INTERVALS[number]

export const ACCOUNT_PERFORMANCE_INTERVAL_KEYS: Record<AccountPerformanceInterval, string> = {
  '1d': 'oneDay', '1w': 'oneWeek', '2w': 'twoWeeks', '1m': 'oneMonth',
  '1y': 'oneYear', '3y': 'threeYears', '5y': 'fiveYears', '10y': 'tenYears',
}

export interface AccountPerformancePoint {
  timestamp: number
  [accountId: string]: number | string | null
}

export function getAccountPerformanceDates(interval: AccountPerformanceInterval, now = new Date()): Date[] {
  const start = interval === '1d' ? subDays(now, 1)
    : interval === '1w' ? subDays(now, 7)
      : interval === '2w' ? subDays(now, 14)
        : interval === '1m' ? subMonths(now, 1)
          : subMonths(now, Number.parseInt(interval, 10) * 12)
  const dates: Date[] = []
  if (interval === '1d') {
    for (let date = start; !isAfter(date, now); date = addHours(date, 1)) dates.push(date)
  } else if (interval === '1w' || interval === '2w' || interval === '1m') {
    for (let date = start; !isAfter(date, now); date = addDays(date, 1)) dates.push(date)
  } else {
    for (let date = start; !isAfter(date, now); date = addMonths(date, 1)) dates.push(date)
  }
  if (dates.length === 0 || dates[dates.length - 1].getTime() !== now.getTime()) dates.push(now)
  return dates
}

export function buildAccountPerformanceData(
  accounts: Account[], transactions: Transaction[], interval: AccountPerformanceInterval,
  baseCurrency: string, getRateForPair: (from: string, to: string) => number | null, now = new Date(),
): AccountPerformancePoint[] {
  const dates = getAccountPerformanceDates(interval, now)
  const transactionsByAccount = new Map(accounts.map((account) => [
    account.id,
    transactions.filter((tx) => tx.status !== 'cancelled' && (tx.accountId === account.id || tx.toAccountId === account.id)),
  ]))
  return dates.map((date) => {
    const point: AccountPerformancePoint = {
      timestamp: date.getTime(),
    }
    for (const account of accounts) {
      const accountTransactions = transactionsByAccount.get(account.id) ?? []
      const balance = getAccountBalanceAtDate(account, accountTransactions, date)
      const rate = account.currency === baseCurrency ? 1 : getRateForPair(account.currency, baseCurrency)
      point[account.id] = rate === null ? null : convertToBase(balance, rate)
    }
    return point
  })
}
