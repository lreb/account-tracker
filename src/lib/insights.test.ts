import { describe, it, expect } from 'vitest'

import {
  detectRecurringPatterns,
  getCategoryAlerts,
  getSpendingProjection,
  getFuelEfficiencyTrend,
} from '@/lib/insights'
import type { Transaction, FuelLog } from '@/types'

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _id = 0
function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'date' | 'amount' | 'categoryId'>,
): Transaction {
  return {
    id: `tx-${++_id}`,
    type: 'expense',
    status: 'cleared',
    accountId: 'acc1',
    currency: 'USD',
    description: '',
    ...overrides,
  }
}

let _logId = 0
function makeLog(
  overrides: Partial<FuelLog> & Pick<FuelLog, 'date' | 'odometer' | 'liters'>,
): FuelLog {
  return {
    id: `log-${++_logId}`,
    vehicleId: 'v1',
    totalCost: 0,
    ...overrides,
  }
}

/** ISO datetime string for a given date at noon UTC, avoiding midnight boundary issues. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`
}

// Fixed "now" used across tests: April 15, 2025 at noon UTC.
const NOW = new Date('2025-04-15T12:00:00.000Z')

// ─── detectRecurringPatterns ──────────────────────────────────────────────────

describe('detectRecurringPatterns', () => {
  it('returns empty array for no transactions', () => {
    expect(detectRecurringPatterns([], NOW)).toEqual([])
  })

  it('detects a recurring monthly expense', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 10), amount: 5000, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 3, 10), amount: 5000, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 2, 10), amount: 5000, categoryId: 'streaming' }),
    ]
    const patterns = detectRecurringPatterns(txs, NOW)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].categoryId).toBe('streaming')
    expect(patterns[0].occurrences).toBe(3)
    expect(patterns[0].dayOfMonth).toBe(10)
    expect(patterns[0].representativeAmount).toBe(5000)
  })

  it('does not detect a pattern with fewer distinct months than minOccurrences', () => {
    // Two transactions in the SAME month — only 1 distinct month
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 5),  amount: 5000, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 4, 10), amount: 5000, categoryId: 'streaming' }),
    ]
    expect(detectRecurringPatterns(txs, NOW, 6, 2)).toEqual([])
  })

  it('ignores cancelled transactions', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 10), amount: 5000, categoryId: 'streaming', status: 'cancelled' }),
      makeTx({ date: iso(2025, 3, 10), amount: 5000, categoryId: 'streaming', status: 'cancelled' }),
      makeTx({ date: iso(2025, 2, 10), amount: 5000, categoryId: 'streaming', status: 'cancelled' }),
    ]
    expect(detectRecurringPatterns(txs, NOW)).toEqual([])
  })

  it('ignores income and transfer transactions', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 10), amount: 5000, categoryId: 'salary',    type: 'income' }),
      makeTx({ date: iso(2025, 3, 10), amount: 5000, categoryId: 'salary',    type: 'income' }),
      makeTx({ date: iso(2025, 2, 10), amount: 5000, categoryId: 'salary',    type: 'income' }),
    ]
    expect(detectRecurringPatterns(txs, NOW)).toEqual([])
  })

  it('clusters amounts within ±5% tolerance', () => {
    // 5000, 5100, 4900 — all within 5% of 5000
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 10), amount: 5000, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 3, 10), amount: 5100, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 2, 10), amount: 4900, categoryId: 'streaming' }),
    ]
    const patterns = detectRecurringPatterns(txs, NOW)
    expect(patterns).toHaveLength(1)
  })

  it('respects cross-currency amounts via exchangeRate', () => {
    // All three resolve to 5000 base-currency cents after applying exchange rate
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 10), amount: 5000, categoryId: 'streaming', exchangeRate: 1 }),
      makeTx({ date: iso(2025, 3, 10), amount: 4000, categoryId: 'streaming', exchangeRate: 1.25 }), // → 5000
      makeTx({ date: iso(2025, 2, 10), amount: 2500, categoryId: 'streaming', exchangeRate: 2 }),     // → 5000
    ]
    const patterns = detectRecurringPatterns(txs, NOW)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].representativeAmount).toBe(5000)
  })

  it('uses local date (not UTC slice) for month bucketing', () => {
    // All three transactions are at 00:30 UTC which is the last day of the PREVIOUS
    // month in UTC-1 but the stated month in UTC+0 or later. Using format(parseISO(), 'yyyy-MM')
    // (local) vs slice(0,7) (UTC) the behaviour differs only on timezone boundary.
    // Here we verify that three transactions clearly in three different months are
    // detected as a pattern regardless of time component.
    const txs: Transaction[] = [
      makeTx({ date: '2025-04-01T00:30:00.000Z', amount: 5000, categoryId: 'rent' }),
      makeTx({ date: '2025-03-01T00:30:00.000Z', amount: 5000, categoryId: 'rent' }),
      makeTx({ date: '2025-02-01T00:30:00.000Z', amount: 5000, categoryId: 'rent' }),
    ]
    const patterns = detectRecurringPatterns(txs, NOW)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].occurrences).toBe(3)
  })

  it('does not detect a pattern when day-of-month variance is too high', () => {
    // Days: 1, 15, 28 — std dev > 7
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 1),  amount: 5000, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 3, 15), amount: 5000, categoryId: 'streaming' }),
      makeTx({ date: iso(2025, 2, 28), amount: 5000, categoryId: 'streaming' }),
    ]
    expect(detectRecurringPatterns(txs, NOW)).toEqual([])
  })
})

// ─── getCategoryAlerts ────────────────────────────────────────────────────────

describe('getCategoryAlerts', () => {
  it('returns empty array for no transactions', () => {
    expect(getCategoryAlerts([], NOW)).toEqual([])
  })

  it('alerts on a category with zero prior spend history (all zeros)', () => {
    // Brand-new category: history array has 12 zeros, avg=0, threshold=0.
    // Any current-month spend > 0 exceeds the threshold and triggers an alert.
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 10), amount: 9000, categoryId: 'newcat' }),
    ]
    const alerts = getCategoryAlerts(txs, NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].categoryId).toBe('newcat')
    expect(alerts[0].avgCents).toBe(0)
    // percentAbove is 0 when avgCents is 0 (avoid division by zero)
    expect(alerts[0].percentAbove).toBe(0)
  })

  it('fires an alert when current month spend exceeds avg + stdDev', () => {
    const txs: Transaction[] = [
      // 3 months of stable history at 3000 cents each
      makeTx({ date: iso(2025, 3, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 2, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 1, 15), amount: 3000, categoryId: 'food' }),
      // Current month: big spike
      makeTx({ date: iso(2025, 4, 10), amount: 12000, categoryId: 'food' }),
    ]
    const alerts = getCategoryAlerts(txs, NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].categoryId).toBe('food')
    expect(alerts[0].currentMonthCents).toBe(12000)
    expect(alerts[0].avgCents).toBe(3000)
    expect(alerts[0].percentAbove).toBeGreaterThan(0)
  })

  it('does not fire when current spend is within avg + stdDev', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 3, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 2, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 1, 15), amount: 3000, categoryId: 'food' }),
      // Current month: same amount as history
      makeTx({ date: iso(2025, 4, 10), amount: 3000, categoryId: 'food' }),
    ]
    expect(getCategoryAlerts(txs, NOW)).toHaveLength(0)
  })

  it('includes zero-spend calendar months in history (not just non-zero months)', () => {
    // Category has spend in Jan 2025 and current month Apr 2025.
    // Feb and Mar have zero spend. With calendar-month history the avg is
    // (3000 + 0 + 0) / 3 = 1000, so the Apr spike of 8000 should fire an alert.
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 1, 15), amount: 3000, categoryId: 'food' }),
      // Feb and Mar: no spend
      makeTx({ date: iso(2025, 4, 10), amount: 8000, categoryId: 'food' }),
    ]
    const alerts = getCategoryAlerts(txs, NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].avgCents).toBe(1000) // (3000 + 0 + 0) / 3
  })

  it('ignores cancelled transactions', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 3, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 2, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 1, 15), amount: 3000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 4, 10), amount: 12000, categoryId: 'food', status: 'cancelled' }),
    ]
    // Current month has no non-cancelled spend → no alert
    expect(getCategoryAlerts(txs, NOW)).toHaveLength(0)
  })

  it('handles cross-currency amounts correctly using exchangeRate', () => {
    // History: 2000 EUR × rate 2 = 4000 base cents each month
    // Current: 2000 EUR × rate 2 = 4000 but double-spends in April = 8000
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 3, 15), amount: 2000, categoryId: 'travel', exchangeRate: 2 }),
      makeTx({ date: iso(2025, 2, 15), amount: 2000, categoryId: 'travel', exchangeRate: 2 }),
      makeTx({ date: iso(2025, 1, 15), amount: 2000, categoryId: 'travel', exchangeRate: 2 }),
      makeTx({ date: iso(2025, 4, 5),  amount: 2000, categoryId: 'travel', exchangeRate: 2 }),
      makeTx({ date: iso(2025, 4, 10), amount: 2000, categoryId: 'travel', exchangeRate: 2 }),
      makeTx({ date: iso(2025, 4, 12), amount: 2000, categoryId: 'travel', exchangeRate: 2 }),
    ]
    const alerts = getCategoryAlerts(txs, NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].currentMonthCents).toBe(12000) // 3 × 4000
    expect(alerts[0].avgCents).toBe(4000)           // 3-month rolling avg
  })
})

// ─── getSpendingProjection ────────────────────────────────────────────────────

describe('getSpendingProjection', () => {
  it('returns zero projection for no transactions', () => {
    const proj = getSpendingProjection([], NOW)
    expect(proj.totalSpentSoFarCents).toBe(0)
    expect(proj.totalProjectedCents).toBe(0)
    expect(proj.byCategory).toHaveLength(0)
  })

  it('projects correctly at mid-month based on daily run-rate', () => {
    // April 2025 has 30 days. NOW is day 15.
    // 3000 spent in 15 days → rate = 200/day → projection = 200 × 30 = 6000
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 5),  amount: 1500, categoryId: 'food' }),
      makeTx({ date: iso(2025, 4, 10), amount: 1500, categoryId: 'food' }),
    ]
    const proj = getSpendingProjection(txs, NOW)
    expect(proj.daysElapsed).toBe(15)
    expect(proj.daysInMonth).toBe(30)
    expect(proj.totalSpentSoFarCents).toBe(3000)
    expect(proj.totalProjectedCents).toBe(6000)
  })

  it('breaks projection down by category', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 5),  amount: 2000, categoryId: 'food' }),
      makeTx({ date: iso(2025, 4, 5),  amount: 1000, categoryId: 'transport' }),
    ]
    const proj = getSpendingProjection(txs, NOW)
    expect(proj.byCategory).toHaveLength(2)
    const food = proj.byCategory.find((c) => c.categoryId === 'food')
    expect(food?.spentSoFarCents).toBe(2000)
  })

  it('ignores transactions from previous months', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 3, 15), amount: 50000, categoryId: 'food' }), // last month
      makeTx({ date: iso(2025, 4, 5),  amount: 1000,  categoryId: 'food' }), // this month
    ]
    const proj = getSpendingProjection(txs, NOW)
    expect(proj.totalSpentSoFarCents).toBe(1000)
  })

  it('sorts byCategory descending by projected amount', () => {
    const txs: Transaction[] = [
      makeTx({ date: iso(2025, 4, 5), amount: 500,  categoryId: 'transport' }),
      makeTx({ date: iso(2025, 4, 5), amount: 2000, categoryId: 'food' }),
    ]
    const proj = getSpendingProjection(txs, NOW)
    expect(proj.byCategory[0].categoryId).toBe('food')
    expect(proj.byCategory[1].categoryId).toBe('transport')
  })
})

// ─── getFuelEfficiencyTrend ───────────────────────────────────────────────────

describe('getFuelEfficiencyTrend', () => {
  it('returns null when there are not enough logs for 2×windowSize pairs', () => {
    // 4 logs → 3 pairs, but windowSize=5 needs 10 pairs minimum
    const logs: FuelLog[] = [
      makeLog({ date: iso(2025, 1, 1), odometer: 0,    liters: 40 }),
      makeLog({ date: iso(2025, 2, 1), odometer: 500,  liters: 40 }),
      makeLog({ date: iso(2025, 3, 1), odometer: 1000, liters: 40 }),
      makeLog({ date: iso(2025, 4, 1), odometer: 1500, liters: 40 }),
    ]
    expect(getFuelEfficiencyTrend(logs, 5)).toBeNull()
  })

  it('returns null for an empty log array', () => {
    expect(getFuelEfficiencyTrend([], 5)).toBeNull()
  })

  it('detects degrading efficiency when recent avg is > 10% below baseline', () => {
    // 11 logs → 10 pairs (pairs [0..4] = baseline, pairs [5..9] = recent).
    // Baseline: 500 km / 40 L = 12.5 km/L each.
    // Recent:   400 km / 40 L = 10.0 km/L each.
    // Degradation = (12.5 - 10) / 12.5 × 100 = 20%.
    const odos = [0, 500, 1000, 1500, 2000, 2500, 2900, 3300, 3700, 4100, 4500]
    const logs: FuelLog[] = odos.map((odo, i) =>
      makeLog({ date: iso(2025, i + 1, 1), odometer: odo, liters: 40 }),
    )
    const trend = getFuelEfficiencyTrend(logs, 5)
    expect(trend).not.toBeNull()
    expect(trend!.isDegrading).toBe(true)
    expect(trend!.degradationPercent).toBeCloseTo(20, 1)
    expect(trend!.baselineKmPerL).toBeCloseTo(12.5, 1)
    expect(trend!.recentKmPerL).toBeCloseTo(10.0, 1)
  })

  it('returns isDegrading=false when efficiency is stable', () => {
    const logs: FuelLog[] = []
    let odo = 0
    for (let i = 0; i < 11; i++) {
      logs.push(makeLog({ date: iso(2025, i + 1, 1), odometer: odo, liters: 40 }))
      odo += 500
    }
    const trend = getFuelEfficiencyTrend(logs, 5)
    expect(trend).not.toBeNull()
    expect(trend!.isDegrading).toBe(false)
    expect(trend!.degradationPercent).toBeCloseTo(0, 1)
  })

  it('exposes windowSize in the return value', () => {
    const logs: FuelLog[] = []
    let odo = 0
    for (let i = 0; i < 11; i++) {
      logs.push(makeLog({ date: iso(2025, i + 1, 1), odometer: odo, liters: 40 }))
      odo += 500
    }
    const trend = getFuelEfficiencyTrend(logs, 5)
    expect(trend!.windowSize).toBe(5)
  })

  it('skips pairs where km delta is zero or negative', () => {
    // Log sequence: 0 → 0 → 500 → 500 → 1000 (only pairs [0→500], [500→1000] are valid)
    // 5 logs but only 2 valid pairs — not enough for windowSize=3
    const logs: FuelLog[] = [
      makeLog({ date: iso(2025, 1, 1), odometer: 0,    liters: 40 }),
      makeLog({ date: iso(2025, 2, 1), odometer: 0,    liters: 40 }), // 0 km delta — skipped
      makeLog({ date: iso(2025, 3, 1), odometer: 500,  liters: 40 }),
      makeLog({ date: iso(2025, 4, 1), odometer: 500,  liters: 40 }), // 0 km delta — skipped
      makeLog({ date: iso(2025, 5, 1), odometer: 1000, liters: 40 }),
    ]
    expect(getFuelEfficiencyTrend(logs, 3)).toBeNull()
  })

  it('sorts logs by date before computing pairs (order-independent input)', () => {
    // 11 logs: sequential months, sequential odometer values (all valid pairs).
    // Provide them in reverse order — the function should sort and produce
    // the same result as the chronologically ordered input.
    const ordered: FuelLog[] = Array.from({ length: 11 }, (_, i) =>
      makeLog({ date: iso(2025, i + 1, 1), odometer: i * 500, liters: 40 }),
    )
    const reversed = [...ordered].reverse()
    expect(getFuelEfficiencyTrend(reversed, 5)).toEqual(getFuelEfficiencyTrend(ordered, 5))
  })
})
