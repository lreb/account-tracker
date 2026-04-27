import {
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  differenceInCalendarDays,
  subMonths,
  getDate,
  format,
  parseISO,
} from 'date-fns'
import { convertToBase } from '@/lib/currency'
import type { Transaction, FuelLog } from '@/types'

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Convert a transaction to base-currency cents. */
function toBase(tx: Transaction): number {
  return convertToBase(tx.amount, tx.exchangeRate ?? 1)
}

/** Group an array by a key function. */
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    ;(acc[k] ??= []).push(item)
    return acc
  }, {})
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecurringPattern {
  categoryId: string
  /** Median amount in base-currency cents */
  representativeAmount: number
  /** Median day-of-month the transaction appears (1–31) */
  dayOfMonth: number
  /** Number of distinct months the pattern was found in */
  occurrences: number
  /** ISO 8601 date of the most recent matching transaction */
  lastDate: string
}

export interface CategoryAlert {
  categoryId: string
  /** Current month's total in base-currency cents */
  currentMonthCents: number
  /** Rolling 3-month average in base-currency cents (months before current) */
  avgCents: number
  stdDevCents: number
  /** How many % above the average (can be negative) */
  percentAbove: number
}

export interface SavingsSuggestion {
  categoryId: string
  currentMonthCents: number
  avgCents: number
  /** How much could be saved by returning to the historical average */
  potentialSavingCents: number
  priority: 'high' | 'medium' | 'low'
}

export interface CategoryProjection {
  categoryId: string
  spentSoFarCents: number
  projectedCents: number
}

export interface SpendingProjection {
  daysElapsed: number
  daysInMonth: number
  totalSpentSoFarCents: number
  totalProjectedCents: number
  byCategory: CategoryProjection[]
}

// ─── T1-1: Recurring pattern detection ───────────────────────────────────────

/**
 * Detect recurring expense transactions over the last `lookbackMonths` months.
 *
 * A "pattern" is a group of transactions in the same category whose amounts
 * are within ±5 % of each other, appearing in at least `minOccurrences`
 * distinct calendar months on a similar day of month (±7 days).
 */
export function detectRecurringPatterns(
  transactions: Transaction[],
  now: Date = new Date(),
  lookbackMonths = 6,
  minOccurrences = 2,
): RecurringPattern[] {
  const cutoff = subMonths(startOfMonth(now), lookbackMonths).toISOString()

  const expenses = transactions.filter(
    (tx) =>
      tx.type === 'expense' &&
      tx.status !== 'cancelled' &&
      tx.date >= cutoff,
  )

  const byCategory = groupBy(expenses, (tx) => tx.categoryId)
  const patterns: RecurringPattern[] = []

  for (const [categoryId, txs] of Object.entries(byCategory)) {
    // Sort ascending so we can cluster by amount
    const sorted = [...txs].sort((a, b) => toBase(a) - toBase(b))

    // Cluster by amount (±5 %)
    const clusters: Transaction[][] = []
    for (const tx of sorted) {
      const amt = toBase(tx)
      const matched = clusters.find((c) => {
        const rep = toBase(c[0])
        return Math.abs(amt - rep) / Math.max(rep, 1) <= 0.05
      })
      if (matched) {
        matched.push(tx)
      } else {
        clusters.push([tx])
      }
    }

    for (const cluster of clusters) {
      if (cluster.length < minOccurrences) continue

      // Count distinct months (use local date to avoid UTC midnight crossings)
      const months = new Set(cluster.map((tx) => format(parseISO(tx.date), 'yyyy-MM')))
      if (months.size < minOccurrences) continue

      // Check day-of-month regularity (std dev ≤ 7 days counts as regular)
      const days = cluster.map((tx) => getDate(new Date(tx.date))).sort((a, b) => a - b)
      const dayStdDev = stdDev(days)
      if (dayStdDev > 7) continue

      const amounts = cluster.map(toBase).sort((a, b) => a - b)
      const sortedCluster = [...cluster].sort((a, b) => b.date.localeCompare(a.date))

      patterns.push({
        categoryId,
        representativeAmount: median(amounts),
        dayOfMonth: median(days),
        occurrences: months.size,
        lastDate: sortedCluster[0].date,
      })
    }
  }

  return patterns.sort((a, b) => b.occurrences - a.occurrences)
}

// ─── T1-2: Category-vs-average alert ─────────────────────────────────────────

/**
 * For each expense category, compare the current month's spending to the
 * rolling 3-month average (months before the current). Returns only categories
 * where currentMonth > avg + 1 * stdDev.
 */
export function getCategoryAlerts(
  transactions: Transaction[],
  now: Date = new Date(),
): CategoryAlert[] {
  const currentStart = startOfMonth(now).toISOString()
  const currentEnd = endOfMonth(now).toISOString()

  const expenseTransactions = transactions.filter(
    (tx) => tx.type === 'expense' && tx.status !== 'cancelled',
  )
  const categoryIds = Array.from(new Set(expenseTransactions.map((tx) => tx.categoryId)))

  // Build last 12 monthly totals per category (not including current month),
  // preserving calendar months with explicit 0 totals when a category has no spend.
  const monthlyTotals: Record<string, number[]> = {}
  for (const catId of categoryIds) {
    monthlyTotals[catId] = []
  }

  for (let i = 1; i <= 12; i++) {
    const monthDate = subMonths(now, i)
    const mStart = startOfMonth(monthDate).toISOString()
    const mEnd = endOfMonth(monthDate).toISOString()

    const txs = expenseTransactions.filter((tx) => tx.date >= mStart && tx.date <= mEnd)
    const byCat = groupBy(txs, (tx) => tx.categoryId)

    for (const catId of categoryIds) {
      const catTxs = byCat[catId] ?? []
      const total = catTxs.reduce((s, tx) => s + toBase(tx), 0)
      monthlyTotals[catId].push(total)
    }
  }

  // Current month expenses per category
  const currentTxs = transactions.filter(
    (tx) =>
      tx.type === 'expense' &&
      tx.status !== 'cancelled' &&
      tx.date >= currentStart &&
      tx.date <= currentEnd,
  )
  const currentByCat = groupBy(currentTxs, (tx) => tx.categoryId)

  const alerts: CategoryAlert[] = []

  for (const [catId, catTxs] of Object.entries(currentByCat)) {
    const currentMonthCents = catTxs.reduce((s, tx) => s + toBase(tx), 0)
    const history = monthlyTotals[catId] ?? []
    if (history.length < 2) continue // not enough history to compare

    // Use only last 3 months for rolling avg
    const recentHistory = history.slice(0, 3)
    const avgCents = Math.round(
      recentHistory.reduce((s, v) => s + v, 0) / recentHistory.length,
    )
    const stdDevCents = Math.round(stdDev(recentHistory))
    const threshold = avgCents + stdDevCents

    if (currentMonthCents <= threshold) continue

    const percentAbove =
      avgCents > 0 ? Math.round(((currentMonthCents - avgCents) / avgCents) * 100) : 0

    alerts.push({ categoryId: catId, currentMonthCents, avgCents, stdDevCents, percentAbove })
  }

  return alerts.sort((a, b) => b.percentAbove - a.percentAbove)
}

// ─── Savings suggestions ──────────────────────────────────────────────────────

/**
 * Produce savings suggestions by identifying the categories where current-month
 * spending most exceeds the 3-month historical average.
 */
export function getSavingsSuggestions(
  transactions: Transaction[],
  now: Date = new Date(),
  topN = 5,
): SavingsSuggestion[] {
  const alerts = getCategoryAlerts(transactions, now)

  return alerts
    .filter((a) => a.currentMonthCents > a.avgCents)
    .slice(0, topN)
    .map((a) => {
      const potentialSavingCents = a.currentMonthCents - a.avgCents
      const priority: SavingsSuggestion['priority'] =
        a.percentAbove >= 50 ? 'high' : a.percentAbove >= 20 ? 'medium' : 'low'
      return {
        categoryId: a.categoryId,
        currentMonthCents: a.currentMonthCents,
        avgCents: a.avgCents,
        potentialSavingCents,
        priority,
      }
    })
}

// ─── T1-3: Current-month spending projection ──────────────────────────────────

/**
 * Projects how much will be spent by end of current month based on the daily
 * spend rate so far. Breaks down by category.
 */
export function getSpendingProjection(
  transactions: Transaction[],
  now: Date = new Date(),
): SpendingProjection {
  const monthStart = startOfMonth(now)
  const monthStartIso = monthStart.toISOString()
  const monthEndIso = endOfMonth(now).toISOString()

  const daysInMonth = getDaysInMonth(now)
  // differenceInCalendarDays is 0 on day 1, so clamp to at least 1
  const daysElapsed = Math.max(
    1,
    differenceInCalendarDays(now, monthStart) + 1,
  )

  const currentTxs = transactions.filter(
    (tx) =>
      tx.type === 'expense' &&
      tx.status !== 'cancelled' &&
      tx.date >= monthStartIso &&
      tx.date <= monthEndIso,
  )

  const totalSpentSoFarCents = currentTxs.reduce((s, tx) => s + toBase(tx), 0)
  const dailyRate = totalSpentSoFarCents / daysElapsed
  const totalProjectedCents = Math.round(dailyRate * daysInMonth)

  const byCat = groupBy(currentTxs, (tx) => tx.categoryId)
  const byCategory: CategoryProjection[] = Object.entries(byCat).map(
    ([categoryId, txs]) => {
      const spentSoFarCents = txs.reduce((s, tx) => s + toBase(tx), 0)
      const projectedCents = Math.round((spentSoFarCents / daysElapsed) * daysInMonth)
      return { categoryId, spentSoFarCents, projectedCents }
    },
  )

  byCategory.sort((a, b) => b.projectedCents - a.projectedCents)

  return { daysElapsed, daysInMonth, totalSpentSoFarCents, totalProjectedCents, byCategory }
}

// ─── T1-5: Fuel efficiency trend alert ───────────────────────────────────────

export interface FuelEfficiencyTrend {
  /** Moving average km/L over the baseline window (fill-ups before the recent window) */
  baselineKmPerL: number
  /** Moving average km/L over the most recent window of fill-ups */
  recentKmPerL: number
  /** Degradation % — positive means efficiency got worse, negative means improved */
  degradationPercent: number
  /** True when recent avg is more than 10 % below the baseline avg */
  isDegrading: boolean
  /** How many consecutive fill-up pairs were analysed in total */
  sampleSize: number
  /** Size of the recent and baseline windows used for the comparison */
  windowSize: number
}

/**
 * Compute a fuel efficiency trend for a single vehicle's fuel logs.
 *
 * Strategy:
 * - Sort logs chronologically by date.
 * - Compute km/L for each consecutive pair (requires positive km delta and positive liters).
 * - Split the resulting series into two non-overlapping windows of `windowSize`:
 *     baseline = fill-ups [ -(2*windowSize) .. -windowSize )  (older)
 *     recent   = fill-ups [ -windowSize .. end )              (newer)
 * - Flag `isDegrading` when recent avg < baseline avg × 0.90 (> 10 % worse).
 *
 * Returns `null` when there are fewer than `2 * windowSize` valid pairs.
 */
export function getFuelEfficiencyTrend(
  logs: FuelLog[],
  windowSize = 5,
): FuelEfficiencyTrend | null {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))

  const efficiencies: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const km = sorted[i].odometer - sorted[i - 1].odometer
    if (km > 0 && sorted[i].liters > 0) {
      efficiencies.push(km / sorted[i].liters)
    }
  }

  if (efficiencies.length < windowSize * 2) return null

  const baseline = efficiencies.slice(-windowSize * 2, -windowSize)
  const recent   = efficiencies.slice(-windowSize)

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

  const baselineKmPerL = avg(baseline)
  const recentKmPerL   = avg(recent)

  const degradationPercent =
    baselineKmPerL > 0
      ? Math.round(((baselineKmPerL - recentKmPerL) / baselineKmPerL) * 10000) / 100
      : 0

  return {
    baselineKmPerL:    Math.round(baselineKmPerL * 100) / 100,
    recentKmPerL:      Math.round(recentKmPerL * 100) / 100,
    degradationPercent,
    isDegrading:       degradationPercent > 10,
    sampleSize:        efficiencies.length,
    windowSize,
  }
}
