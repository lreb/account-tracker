import { describe, it, expect } from 'vitest'

import { computePeriodSummary, computeCategoryBreakdown } from '@/lib/reports'
import type { Transaction, Category } from '@/types'

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _id = 0
function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'date' | 'amount' | 'type'>,
): Transaction {
  return {
    id: `tx-${++_id}`,
    status: 'cleared',
    accountId: 'acc1',
    categoryId: 'cat1',
    currency: 'USD',
    description: '',
    ...overrides,
  }
}

function makeCat(id: string, name: string, icon = 'circle'): Category {
  return { id, name, icon, isCustom: false, type: 'expense' }
}

/**
 * UTC ISO string for a given date at noon UTC.
 * Using noon avoids midnight boundary issues when tests run in non-UTC timezones.
 */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`
}

/**
 * Build ReportFilters covering a full UTC month, using explicit UTC Date objects
 * so results are timezone-agnostic across CI environments.
 */
function monthFilter(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: new Date(`${year}-${pad(month)}-01T00:00:00.000Z`),
    to:   new Date(`${year}-${pad(month)}-28T23:59:59.999Z`), // safe for all months
  }
}

// ─── computePeriodSummary ──────────────────────────────────────────────────────

describe('computePeriodSummary', () => {
  it('returns zeros when there are no transactions', () => {
    const result = computePeriodSummary([], monthFilter(2026, 5))
    expect(result).toEqual({ income: 0, expenses: 0, net: 0 })
  })

  it('sums income transactions within the date range', () => {
    const txs = [
      makeTx({ type: 'income', amount: 10000, date: iso(2026, 5, 10) }),
      makeTx({ type: 'income', amount: 5000,  date: iso(2026, 5, 20) }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result.income).toBe(15000)
    expect(result.expenses).toBe(0)
    expect(result.net).toBe(15000)
  })

  it('sums expense transactions within the date range', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 3000, date: iso(2026, 5, 5) }),
      makeTx({ type: 'expense', amount: 2000, date: iso(2026, 5, 15) }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result.income).toBe(0)
    expect(result.expenses).toBe(5000)
    expect(result.net).toBe(-5000)
  })

  it('computes net as income minus expenses', () => {
    const txs = [
      makeTx({ type: 'income',  amount: 20000, date: iso(2026, 5, 1) }),
      makeTx({ type: 'expense', amount: 7500,  date: iso(2026, 5, 1) }),
    ]
    const { income, expenses, net } = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(net).toBe(income - expenses)
    expect(net).toBe(12500)
  })

  it('excludes cancelled transactions', () => {
    const txs = [
      makeTx({ type: 'income',  amount: 10000, date: iso(2026, 5, 10) }),
      makeTx({ type: 'income',  amount: 5000,  date: iso(2026, 5, 10), status: 'cancelled' }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result.income).toBe(10000)
  })

  it('excludes transactions outside the date range', () => {
    const txs = [
      makeTx({ type: 'income', amount: 9000, date: iso(2026, 4, 30) }), // previous month
      makeTx({ type: 'income', amount: 1000, date: iso(2026, 5, 15) }), // in range
      makeTx({ type: 'income', amount: 8000, date: iso(2026, 6, 1)  }), // next month
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result.income).toBe(1000)
  })

  it('filters by accountId when provided', () => {
    const txs = [
      makeTx({ type: 'income', amount: 5000, date: iso(2026, 5, 10), accountId: 'acc1' }),
      makeTx({ type: 'income', amount: 3000, date: iso(2026, 5, 10), accountId: 'acc2' }),
    ]
    const result = computePeriodSummary(txs, { ...monthFilter(2026, 5), accountId: 'acc1' })
    expect(result.income).toBe(5000)
  })

  it('excludes transactions for hidden accounts when visibleAccountIds is provided', () => {
    const visible = new Set(['acc1'])
    const txs = [
      makeTx({ type: 'income', amount: 6000, date: iso(2026, 5, 10), accountId: 'acc1' }),
      makeTx({ type: 'income', amount: 4000, date: iso(2026, 5, 10), accountId: 'acc2' }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5), visible)
    expect(result.income).toBe(6000)
  })

  it('applies exchangeRate to convert to base currency', () => {
    // 100 USD at rate 17.50 → 1750 base-currency cents
    const txs = [
      makeTx({ type: 'income', amount: 100, date: iso(2026, 5, 10), exchangeRate: 17.5 }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result.income).toBe(Math.round(100 * 17.5))
  })

  it('uses raw amount when no exchangeRate is set', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 2500, date: iso(2026, 5, 10) }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result.expenses).toBe(2500)
  })

  it('ignores transfer transactions (not counted as income or expense)', () => {
    const txs = [
      makeTx({ type: 'transfer', amount: 50000, date: iso(2026, 5, 10) }),
    ]
    const result = computePeriodSummary(txs, monthFilter(2026, 5))
    expect(result).toEqual({ income: 0, expenses: 0, net: 0 })
  })
})

// ─── computeCategoryBreakdown ─────────────────────────────────────────────────

describe('computeCategoryBreakdown', () => {
  const categories = [
    makeCat('food', 'Food'),
    makeCat('transport', 'Transport'),
    makeCat('salary', 'Salary'),
  ]

  it('returns empty array when no transactions match', () => {
    const result = computeCategoryBreakdown([], categories, monthFilter(2026, 5))
    expect(result).toEqual([])
  })

  it('groups transactions by categoryId and sums amounts', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 3000, date: iso(2026, 5, 1), categoryId: 'food' }),
      makeTx({ type: 'expense', amount: 2000, date: iso(2026, 5, 5), categoryId: 'food' }),
      makeTx({ type: 'expense', amount: 5000, date: iso(2026, 5, 10), categoryId: 'transport' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    const food = result.find((s) => s.categoryId === 'food')
    const transport = result.find((s) => s.categoryId === 'transport')
    expect(food?.amount).toBe(5000)
    expect(transport?.amount).toBe(5000)
  })

  it('computes percent relative to the grand total', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 7500, date: iso(2026, 5, 1), categoryId: 'food' }),
      makeTx({ type: 'expense', amount: 2500, date: iso(2026, 5, 5), categoryId: 'transport' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    const food = result.find((s) => s.categoryId === 'food')
    const transport = result.find((s) => s.categoryId === 'transport')
    expect(food?.percent).toBe(75)
    expect(transport?.percent).toBe(25)
    // Percentages must sum to 100
    const total = result.reduce((s, r) => s + r.percent, 0)
    expect(total).toBe(100)
  })

  it('sorts results descending by amount', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 1000, date: iso(2026, 5, 1), categoryId: 'food' }),
      makeTx({ type: 'expense', amount: 9000, date: iso(2026, 5, 1), categoryId: 'transport' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    expect(result[0].categoryId).toBe('transport')
    expect(result[1].categoryId).toBe('food')
  })

  it('excludes cancelled transactions', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 5000, date: iso(2026, 5, 1),  categoryId: 'food' }),
      makeTx({ type: 'expense', amount: 3000, date: iso(2026, 5, 1),  categoryId: 'food', status: 'cancelled' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    const food = result.find((s) => s.categoryId === 'food')
    expect(food?.amount).toBe(5000)
  })

  it('excludes transactions outside the date range', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 5000, date: iso(2026, 4, 30), categoryId: 'food' }), // out
      makeTx({ type: 'expense', amount: 2000, date: iso(2026, 5, 15), categoryId: 'food' }), // in
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    const food = result.find((s) => s.categoryId === 'food')
    expect(food?.amount).toBe(2000)
  })

  it('returns only expense slices when type is "expense"', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 3000, date: iso(2026, 5, 1), categoryId: 'food' }),
      makeTx({ type: 'income',  amount: 9000, date: iso(2026, 5, 1), categoryId: 'salary' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5), 'expense')
    expect(result.length).toBe(1)
    expect(result[0].categoryId).toBe('food')
  })

  it('returns only income slices when type is "income"', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 3000, date: iso(2026, 5, 1), categoryId: 'food' }),
      makeTx({ type: 'income',  amount: 9000, date: iso(2026, 5, 1), categoryId: 'salary' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5), 'income')
    expect(result.length).toBe(1)
    expect(result[0].categoryId).toBe('salary')
  })

  it('includes transfer transactions when includeTransfers is true', () => {
    const txs = [
      makeTx({ type: 'expense',  amount: 2000, date: iso(2026, 5, 1), categoryId: 'food' }),
      makeTx({ type: 'transfer', amount: 5000, date: iso(2026, 5, 1), categoryId: 'food' }),
    ]
    const resultWithout = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5), 'expense', undefined, false)
    const resultWith    = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5), 'expense', undefined, true)
    const withoutAmt = resultWithout.find((s) => s.categoryId === 'food')?.amount
    const withAmt    = resultWith.find((s) => s.categoryId === 'food')?.amount
    expect(withoutAmt).toBe(2000)
    expect(withAmt).toBe(7000)
  })

  it('filters by accountId when provided', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 4000, date: iso(2026, 5, 1), categoryId: 'food', accountId: 'acc1' }),
      makeTx({ type: 'expense', amount: 6000, date: iso(2026, 5, 1), categoryId: 'food', accountId: 'acc2' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, { ...monthFilter(2026, 5), accountId: 'acc1' })
    const food = result.find((s) => s.categoryId === 'food')
    expect(food?.amount).toBe(4000)
  })

  it('resolves category name and icon from categories list', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 1000, date: iso(2026, 5, 1), categoryId: 'food' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    expect(result[0].name).toBe('Food')
    expect(result[0].icon).toBe('circle')
  })

  it('falls back to categoryId string when category is not found', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 1000, date: iso(2026, 5, 1), categoryId: 'unknown-cat' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    expect(result[0].name).toBe('unknown-cat')
    expect(result[0].icon).toBe('circle')
  })

  it('returns percent 0 when grand total is zero', () => {
    // Edge case: all amounts are 0
    const txs = [
      makeTx({ type: 'expense', amount: 0, date: iso(2026, 5, 1), categoryId: 'food' }),
    ]
    const result = computeCategoryBreakdown(txs, categories, monthFilter(2026, 5))
    expect(result[0].percent).toBe(0)
  })
})
