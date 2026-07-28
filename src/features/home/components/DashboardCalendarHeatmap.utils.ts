import { format } from 'date-fns'
import type { Transaction } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayData {
  /** Total income in integer cents for this local calendar day. */
  income: number
  /** Total expenses in integer cents for this local calendar day. */
  expenses: number
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Aggregates non-cancelled, non-transfer transactions by local calendar date.
 *
 * The date key is derived by formatting the stored UTC ISO date string with
 * `format(new Date(tx.date), 'yyyy-MM-dd')`, which uses the device's local
 * timezone — consistent with the rest of the app (e.g. useGroupedTransactions).
 *
 * Returns a Map keyed by 'yyyy-MM-dd' strings.
 */
export function buildCalendarDayData(transactions: Transaction[]): Map<string, DayData> {
  const map = new Map<string, DayData>()

  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue
    if (tx.type === 'transfer') continue

    const dateKey = format(new Date(tx.date), 'yyyy-MM-dd')
    const existing = map.get(dateKey) ?? { income: 0, expenses: 0 }

    if (tx.type === 'income') {
      existing.income += tx.amount
    } else if (tx.type === 'expense') {
      existing.expenses += tx.amount
    }

    map.set(dateKey, existing)
  }

  return map
}

/**
 * Returns the maximum daily expense value across all days in the map.
 * Used to normalise the red-intensity heatmap.
 * Returns 0 when no expense data is available (safe denominator guard).
 */
export function maxDailyExpense(dayDataMap: Map<string, DayData>): number {
  let max = 0
  for (const data of dayDataMap.values()) {
    if (data.expenses > max) max = data.expenses
  }
  return max
}
