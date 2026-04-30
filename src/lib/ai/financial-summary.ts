// ─── Financial Summary ────────────────────────────────────────────────────────
// Mandatory privacy gate: builds a compact, anonymized summary of the user's
// finances to send to the AI. Raw transaction descriptions, account names,
// account IDs, individual transaction amounts, and personal identifiers are
// NEVER included.

import { startOfMonth, endOfMonth, format, getDaysInMonth, differenceInCalendarDays } from 'date-fns'
import { convertToBase } from '@/lib/currency'
import type { Transaction, Category, Budget } from '@/types'

export interface CategorySummary {
  categoryId: string
  label: string
  amount: number   // base-currency cents
}

export interface BudgetStatusSummary {
  categoryId: string
  label: string
  spent: number    // base-currency cents
  limit: number    // base-currency cents
  pct: number      // 0–100+
}

export interface FinancialSummary {
  period: string              // "YYYY-MM"
  baseCurrency: string
  totalIncome: number         // base-currency cents
  totalExpenses: number       // base-currency cents
  netCashFlow: number
  byCategory: CategorySummary[]
  budgetStatus: BudgetStatusSummary[]
  projection: {
    projectedMonthlyExpense: number
    daysElapsed: number
    daysInMonth: number
  }
}

function categoryLabel(categoryId: string, categories: Category[]): string {
  return categories.find((c) => c.id === categoryId)?.name ?? categoryId
}

export function buildFinancialSummary(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  baseCurrency: string,
  referenceDate: Date = new Date(),
): FinancialSummary {
  const periodStart = startOfMonth(referenceDate)
  const periodEnd = endOfMonth(referenceDate)
  const startStr = periodStart.toISOString()
  const endStr = periodEnd.toISOString()

  const thisMonth = transactions.filter(
    (tx) => tx.status !== 'cancelled' && tx.date >= startStr && tx.date <= endStr,
  )

  const expenses = thisMonth.filter((tx) => tx.type === 'expense')
  const income = thisMonth.filter((tx) => tx.type === 'income')

  const totalExpenses = expenses.reduce(
    (sum, tx) => sum + convertToBase(tx.amount, tx.exchangeRate ?? 1),
    0,
  )
  const totalIncome = income.reduce(
    (sum, tx) => sum + convertToBase(tx.amount, tx.exchangeRate ?? 1),
    0,
  )

  // Expenses grouped by category
  const byCategoryMap = new Map<string, number>()
  for (const tx of expenses) {
    const existing = byCategoryMap.get(tx.categoryId) ?? 0
    byCategoryMap.set(tx.categoryId, existing + convertToBase(tx.amount, tx.exchangeRate ?? 1))
  }
  const byCategory: CategorySummary[] = [...byCategoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId, amount]) => ({
      categoryId,
      label: categoryLabel(categoryId, categories),
      amount,
    }))

  // Budget status (current period matching budgets)
  const budgetStatus: BudgetStatusSummary[] = budgets.map((b) => {
    const spent =
      byCategoryMap.get(b.categoryId) ?? 0
    const limit = b.amount
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
    return {
      categoryId: b.categoryId,
      label: categoryLabel(b.categoryId, categories),
      spent,
      limit,
      pct,
    }
  })

  // Projection
  const daysInMonth = getDaysInMonth(referenceDate)
  const daysElapsed = Math.max(
    1,
    differenceInCalendarDays(referenceDate, periodStart) + 1,
  )
  const projectedMonthlyExpense = Math.round((totalExpenses / daysElapsed) * daysInMonth)

  return {
    period: format(referenceDate, 'yyyy-MM'),
    baseCurrency,
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    byCategory,
    budgetStatus,
    projection: { projectedMonthlyExpense, daysElapsed, daysInMonth },
  }
}

/** Format a FinancialSummary as a concise text block for the AI prompt. */
export function formatSummaryForPrompt(s: FinancialSummary): string {
  const curr = (cents: number) => `${(cents / 100).toFixed(2)} ${s.baseCurrency}`

  const lines = [
    `Period: ${s.period}`,
    `Income: ${curr(s.totalIncome)}`,
    `Expenses: ${curr(s.totalExpenses)}`,
    `Net cash flow: ${curr(s.netCashFlow)}`,
    '',
    'Expenses by category:',
    ...s.byCategory.map((c) => `  ${c.label}: ${curr(c.amount)}`),
  ]

  if (s.budgetStatus.length > 0) {
    lines.push('', 'Budget status:')
    for (const b of s.budgetStatus) {
      lines.push(`  ${b.label}: ${curr(b.spent)} / ${curr(b.limit)} (${b.pct}%)`)
    }
  }

  lines.push(
    '',
    `Spending projection: ${curr(s.projection.projectedMonthlyExpense)} for the full month`,
    `(${s.projection.daysElapsed} of ${s.projection.daysInMonth} days elapsed)`,
  )

  return lines.join('\n')
}
