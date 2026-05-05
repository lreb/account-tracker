import { describe, it, expect } from 'vitest'

import { buildFinancialSummary, summaryToPrompt } from '@/lib/ai-financial-summary'
import type { Transaction, Category, Budget } from '@/types'

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _id = 0
function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'date' | 'amount' | 'categoryId'>,
): Transaction {
  return {
    id: `tx-${++_id}`,
    type: 'expense',
    status: 'cleared',
    accountId: 'acc-secret',
    currency: 'USD',
    description: 'SECRET DESCRIPTION',
    notes: 'SECRET NOTES',
    ...overrides,
  }
}

function makeCategory(id: string, name: string): Category {
  return { id, name, icon: 'circle', isCustom: false, type: 'expense' }
}

function makeBudget(categoryId: string, amount: number): Budget {
  return {
    id: `budget-${categoryId}`,
    categoryId,
    amount,
    period: 'monthly',
    rollover: false,
    startDate: '2025-04-01T00:00:00.000Z',
    currency: 'USD',
  }
}

/** ISO datetime at noon UTC to avoid midnight boundary issues. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`
}

// Fixed reference date: April 15, 2025 at noon UTC (15 days elapsed).
const REFERENCE = new Date('2025-04-15T12:00:00.000Z')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  makeCategory('food', 'Food'),
  makeCategory('transport', 'Transport'),
  makeCategory('rent', 'Rent'),
]

const TRANSACTIONS_APRIL: Transaction[] = [
  makeTx({ date: iso(2025, 4, 3),  amount: 5000,  categoryId: 'food',      type: 'expense' }),
  makeTx({ date: iso(2025, 4, 7),  amount: 3000,  categoryId: 'transport', type: 'expense' }),
  makeTx({ date: iso(2025, 4, 10), amount: 2000,  categoryId: 'food',      type: 'expense' }),
  makeTx({ date: iso(2025, 4, 12), amount: 10000, categoryId: 'rent',      type: 'expense' }),
  makeTx({ date: iso(2025, 4, 5),  amount: 25000, categoryId: 'food',      type: 'income'  }),
]

// ─── buildFinancialSummary — privacy gate ─────────────────────────────────────

describe('buildFinancialSummary — privacy gate', () => {
  it('does not expose raw transaction descriptions', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const json = JSON.stringify(summary)
    expect(json).not.toContain('SECRET DESCRIPTION')
  })

  it('does not expose raw transaction notes', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const json = JSON.stringify(summary)
    expect(json).not.toContain('SECRET NOTES')
  })

  it('does not expose account IDs', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const json = JSON.stringify(summary)
    expect(json).not.toContain('acc-secret')
  })

  it('does not expose individual transaction IDs', () => {
    const txIds = TRANSACTIONS_APRIL.map(t => t.id)
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const json = JSON.stringify(summary)
    for (const id of txIds) {
      expect(json).not.toContain(id)
    }
  })

  it('replaces categoryId with human-readable label in byCategory', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    for (const row of summary.byCategory) {
      // raw IDs like 'food', 'transport', 'rent' must not appear as standalone keys —
      // they should only appear inside the label string
      expect(row.label).not.toBe(row.categoryId)
    }
    const labels = summary.byCategory.map(r => r.label)
    expect(labels).toContain('Food')
    expect(labels).toContain('Transport')
    expect(labels).toContain('Rent')
  })

  it('falls back to categoryId as label when category is not found', () => {
    const txUnknownCat = [makeTx({ date: iso(2025, 4, 5), amount: 1000, categoryId: 'unknown-cat' })]
    const summary = buildFinancialSummary(txUnknownCat, [], [], 'USD', REFERENCE)
    expect(summary.byCategory[0].label).toBe('unknown-cat')
  })
})

// ─── buildFinancialSummary — aggregation logic ────────────────────────────────

describe('buildFinancialSummary — aggregation', () => {
  it('sums income correctly', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    // Only one income tx: 25000 cents
    expect(summary.totalIncome).toBe(25000)
  })

  it('sums expenses correctly', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    // 5000 + 3000 + 2000 + 10000 = 20000
    expect(summary.totalExpenses).toBe(20000)
  })

  it('computes net cash flow as income minus expenses', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.netCashFlow).toBe(summary.totalIncome - summary.totalExpenses)
  })

  it('groups expenses by category and sorts descending by amount', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    // Food: 5000+2000=7000, Rent: 10000, Transport: 3000 → sorted: Rent, Food, Transport
    expect(summary.byCategory[0].label).toBe('Rent')
    expect(summary.byCategory[0].amount).toBe(10000)
    expect(summary.byCategory[1].label).toBe('Food')
    expect(summary.byCategory[1].amount).toBe(7000)
    expect(summary.byCategory[2].label).toBe('Transport')
    expect(summary.byCategory[2].amount).toBe(3000)
  })

  it('does not include income transactions in byCategory expenses', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const totalByCategory = summary.byCategory.reduce((s, c) => s + c.amount, 0)
    expect(totalByCategory).toBe(summary.totalExpenses)
  })

  it('excludes cancelled transactions from all totals', () => {
    const withCancelled = [
      ...TRANSACTIONS_APRIL,
      makeTx({ date: iso(2025, 4, 8), amount: 99999, categoryId: 'food', status: 'cancelled' }),
    ]
    const summary = buildFinancialSummary(withCancelled, CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.totalExpenses).toBe(20000)
    expect(summary.totalIncome).toBe(25000)
  })

  it('excludes transactions outside the reference month', () => {
    const withOutOfRange = [
      ...TRANSACTIONS_APRIL,
      makeTx({ date: iso(2025, 3, 31), amount: 50000, categoryId: 'food' }), // March
      makeTx({ date: iso(2025, 5, 1),  amount: 50000, categoryId: 'food' }), // May
    ]
    const summary = buildFinancialSummary(withOutOfRange, CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.totalExpenses).toBe(20000)
  })

  it('applies exchangeRate when converting to base currency', () => {
    const foreignTx = makeTx({
      date: iso(2025, 4, 5),
      amount: 10000,       // 100 EUR in cents
      categoryId: 'food',
      currency: 'EUR',
      exchangeRate: 1.1,   // 1 EUR = 1.1 USD → 11000 USD cents
    })
    const summary = buildFinancialSummary([foreignTx], CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.totalExpenses).toBe(11000)
  })

  it('treats missing exchangeRate as rate=1', () => {
    const tx = makeTx({ date: iso(2025, 4, 5), amount: 8000, categoryId: 'food' })
    delete tx.exchangeRate
    const summary = buildFinancialSummary([tx], CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.totalExpenses).toBe(8000)
  })

  it('sets period to yyyy-MM of the reference date', () => {
    const summary = buildFinancialSummary([], CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.period).toBe('2025-04')
  })

  it('sets baseCurrency from the argument', () => {
    const summary = buildFinancialSummary([], CATEGORIES, [], 'MXN', REFERENCE)
    expect(summary.baseCurrency).toBe('MXN')
  })

  it('produces empty byCategory when there are no expenses', () => {
    const incomeOnly = [makeTx({ date: iso(2025, 4, 5), amount: 1000, categoryId: 'food', type: 'income' })]
    const summary = buildFinancialSummary(incomeOnly, CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.byCategory).toHaveLength(0)
  })
})

// ─── buildFinancialSummary — budget status ────────────────────────────────────

describe('buildFinancialSummary — budget status', () => {
  it('computes spent and pct for each budget', () => {
    const budgets = [makeBudget('food', 14000)] // Food: 7000 spent of 14000 limit
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, budgets, 'USD', REFERENCE)
    const foodBudget = summary.budgetStatus.find(b => b.label === 'Food')!
    expect(foodBudget.spent).toBe(7000)
    expect(foodBudget.limit).toBe(14000)
    expect(foodBudget.pct).toBe(50)
  })

  it('reports 0 pct when limit is 0 (no division by zero)', () => {
    const budgets = [makeBudget('food', 0)]
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, budgets, 'USD', REFERENCE)
    const foodBudget = summary.budgetStatus.find(b => b.label === 'Food')!
    expect(foodBudget.pct).toBe(0)
  })

  it('excludes budgets whose endDate is before the reference month', () => {
    const expired: Budget = {
      ...makeBudget('food', 10000),
      endDate: '2025-03-31T00:00:00.000Z', // ended before April
    }
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [expired], 'USD', REFERENCE)
    expect(summary.budgetStatus).toHaveLength(0)
  })

  it('includes budgets with no endDate (open-ended)', () => {
    const openBudget = makeBudget('transport', 6000)
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [openBudget], 'USD', REFERENCE)
    expect(summary.budgetStatus).toHaveLength(1)
    expect(summary.budgetStatus[0].label).toBe('Transport')
  })

  it('reports over-100% pct when spending exceeds budget', () => {
    const tightBudget = makeBudget('rent', 5000) // Rent spent 10000 of 5000 limit
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [tightBudget], 'USD', REFERENCE)
    const rentBudget = summary.budgetStatus.find(b => b.label === 'Rent')!
    expect(rentBudget.pct).toBe(200)
  })
})

// ─── buildFinancialSummary — projection ───────────────────────────────────────

describe('buildFinancialSummary — projection', () => {
  it('records daysElapsed correctly for mid-month reference date', () => {
    // April 15 → days 1..15 = 15 elapsed
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.projection.daysElapsed).toBe(15)
  })

  it('projects full-month expense from daily run-rate', () => {
    // totalExpenses=20000, daysElapsed=15, daysInMonth=30
    // projected = round(20000 / 15 * 30) = 40000
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.projection.projectedMonthlyExpense).toBe(40000)
  })

  it('clamps daysElapsed to minimum 1 to avoid divide-by-zero', () => {
    // Reference is the very first day of the month
    const firstDay = new Date('2025-04-01T12:00:00.000Z')
    const tx = makeTx({ date: iso(2025, 4, 1), amount: 3000, categoryId: 'food' })
    const summary = buildFinancialSummary([tx], CATEGORIES, [], 'USD', firstDay)
    expect(summary.projection.daysElapsed).toBeGreaterThanOrEqual(1)
    expect(summary.projection.projectedMonthlyExpense).toBeGreaterThan(0)
  })

  it('returns 0 projected when there are no expenses', () => {
    const summary = buildFinancialSummary([], CATEGORIES, [], 'USD', REFERENCE)
    expect(summary.projection.projectedMonthlyExpense).toBe(0)
  })
})

// ─── summaryToPrompt — privacy gate ──────────────────────────────────────────

describe('summaryToPrompt — privacy gate', () => {
  it('does not include raw categoryIds in the prompt text', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    // Raw IDs ('food', 'transport', 'rent') should NOT appear as standalone tokens
    // — the labels ('Food', 'Transport', 'Rent') replace them
    expect(prompt).not.toMatch(/\bfood\b/)
    expect(prompt).not.toMatch(/\btransport\b/)
    expect(prompt).not.toMatch(/\brent\b/)
  })

  it('includes human-readable category labels', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).toContain('Food')
    expect(prompt).toContain('Transport')
    expect(prompt).toContain('Rent')
  })

  it('includes period header', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).toContain('2025-04')
  })

  it('includes income, expenses, and net lines', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).toContain('Income')
    expect(prompt).toContain('Expenses')
    expect(prompt).toContain('Net')
  })

  it('includes month-end projection line', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).toContain('projection')
  })

  it('omits the byCategory section when there are no expenses', () => {
    const summary = buildFinancialSummary([], CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).not.toContain('Spending by category')
  })

  it('omits the budget section when there are no budgets', () => {
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).not.toContain('Budget status')
  })

  it('includes budget section when budgets exist', () => {
    const budgets = [makeBudget('food', 14000)]
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, budgets, 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).toContain('Budget status')
    expect(prompt).toContain('Food')
    expect(prompt).toContain('50%')
  })

  it('formats amounts as decimal with currency suffix, not raw cents', () => {
    // 20000 cents = 200.00 USD — must NOT appear as raw '20000'
    const summary = buildFinancialSummary(TRANSACTIONS_APRIL, CATEGORIES, [], 'USD', REFERENCE)
    const prompt = summaryToPrompt(summary)
    expect(prompt).not.toContain('20000')
    expect(prompt).toContain('200.00 USD')
  })
})
