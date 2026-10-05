import { addDays, addMinutes, addMonths, isAfter, subDays, subHours, subMonths } from 'date-fns'
import { convertToBase } from '@/lib/currency'
import { getAccountBalanceAtDate } from '@/lib/balance-sheet'
import type { Account, Transaction } from '@/types'

export const ACCOUNT_PERFORMANCE_INTERVALS = [
  '1h', '6h', '12h', '1d', '1w', '2w', '1m', '1y', '3y', '5y', '10y',
] as const

export type AccountPerformanceInterval = typeof ACCOUNT_PERFORMANCE_INTERVALS[number]

export const ACCOUNT_PERFORMANCE_INTERVAL_KEYS: Record<AccountPerformanceInterval, string> = {
  '1h': 'oneHour', '6h': 'sixHours', '12h': 'twelveHours',
  '1d': 'oneDay', '1w': 'oneWeek', '2w': 'twoWeeks', '1m': 'oneMonth',
  '1y': 'oneYear', '3y': 'threeYears', '5y': 'fiveYears', '10y': 'tenYears',
}

export interface AccountPerformancePoint {
  timestamp: number
  [accountId: string]: number | string | null
}

export interface AccountBalanceCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

const INTERVAL_STARTERS: Record<AccountPerformanceInterval, (now: Date) => Date> = {
  '1h': (now) => subHours(now, 1),
  '6h': (now) => subHours(now, 6),
  '12h': (now) => subHours(now, 12),
  '1d': (now) => subDays(now, 1),
  '1w': (now) => subDays(now, 7),
  '2w': (now) => subDays(now, 14),
  '1m': (now) => subMonths(now, 1),
  '1y': (now) => subMonths(now, 12),
  '3y': (now) => subMonths(now, 36),
  '5y': (now) => subMonths(now, 60),
  '10y': (now) => subMonths(now, 120),
}

const INTERVAL_STEPS: Record<AccountPerformanceInterval, number> = {
  '1h': 5 * 60_000, '6h': 15 * 60_000, '12h': 30 * 60_000,
  '1d': 60 * 60_000, '1w': 24 * 60 * 60_000, '2w': 24 * 60 * 60_000,
  '1m': 24 * 60 * 60_000, '1y': 30 * 24 * 60 * 60_000,
  '3y': 30 * 24 * 60 * 60_000, '5y': 30 * 24 * 60 * 60_000,
  '10y': 30 * 24 * 60 * 60_000,
}

export function getAccountPerformanceDates(interval: AccountPerformanceInterval, now = new Date()): Date[] {
  const start = INTERVAL_STARTERS[interval](now)
  const dates: Date[] = []
  const step = INTERVAL_STEPS[interval]
  if (step < 24 * 60 * 60_000) {
    for (let date = start; !isAfter(date, now); date = addMinutes(date, step / 60_000)) dates.push(date)
  } else if (step < 30 * 24 * 60 * 60_000) {
    for (let date = start; !isAfter(date, now); date = addDays(date, 1)) dates.push(date)
  } else {
    for (let date = start; !isAfter(date, now); date = addMonths(date, 1)) dates.push(date)
  }
  if (dates.length === 0 || dates[dates.length - 1].getTime() !== now.getTime()) dates.push(now)
  return dates
}

export function buildCombinedAccountCandles(
  accounts: Account[], transactions: Transaction[], interval: AccountPerformanceInterval,
  baseCurrency: string, getRateForPair: (from: string, to: string) => number | null, now = new Date(),
): AccountBalanceCandle[] {
  if (accounts.length === 0) return []
  const boundaries = getAccountPerformanceDates(interval, now)
  const accountTransactions = new Map(accounts.map((account) => [
    account.id,
    transactions.filter((tx) => tx.status !== 'cancelled' && (tx.accountId === account.id || tx.toAccountId === account.id)),
  ]))
  const toBaseBalance = (at: Date): number | null => {
    let total = 0
    for (const account of accounts) {
      const rate = account.currency === baseCurrency ? 1 : getRateForPair(account.currency, baseCurrency)
      if (rate === null) return null
      total += convertToBase(getAccountBalanceAtDate(account, accountTransactions.get(account.id) ?? [], at), rate)
    }
    return total
  }
  const allTransactions = accounts.flatMap((account) => accountTransactions.get(account.id) ?? [])
  const candles: AccountBalanceCandle[] = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const bucketStart = boundaries[index]
    const bucketEnd = boundaries[index + 1]
    const opening = toBaseBalance(bucketStart)
    const closing = toBaseBalance(bucketEnd)
    if (opening === null || closing === null) continue
    const sampledBalances = allTransactions
      .filter((tx) => new Date(tx.date).getTime() > bucketStart.getTime() && new Date(tx.date).getTime() <= bucketEnd.getTime())
      .map((tx) => toBaseBalance(new Date(tx.date)))
      .filter((value): value is number => value !== null)
    const values = [opening, closing, ...sampledBalances]
    candles.push({
      timestamp: bucketStart.getTime(),
      open: opening,
      high: values.reduce((high, value) => Math.max(high, value), Number.NEGATIVE_INFINITY),
      low: values.reduce((low, value) => Math.min(low, value), Number.POSITIVE_INFINITY),
      close: closing,
    })
  }
  return candles
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
