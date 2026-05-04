import {
  startOfMonth,
  endOfMonth,
  format,
  getDaysInMonth,
  differenceInCalendarDays,
} from 'date-fns'
import { convertToBase } from '@/lib/currency'
import { detectRecurringPatterns } from '@/lib/insights'
import type { Transaction, Category, Budget } from '@/types'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FinancialSummary {
  period: string           // "yyyy-MM"
  baseCurrency: string
  totalIncome: number      // base-currency cents
  totalExpenses: number
  netCashFlow: number
  byCategory: { categoryId: string; label: string; amount: number }[]
  budgetStatus: { categoryId: string; label: string; spent: number; limit: number; pct: number }[]
  topRecurring: { label: string; avgAmount: number; frequency: string }[]
  projection: { projectedMonthlyExpense: number; daysElapsed: number }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toBase(tx: Transaction): number {
  return convertToBase(tx.amount, tx.exchangeRate ?? 1)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a sanitised financial summary for the given reference month.
 * This is the mandatory data gate — only aggregated category totals are
 * included. Raw descriptions, notes, account names, and individual amounts
 * are never present in the output.
 */
export function buildFinancialSummary(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  baseCurrency: string,
  referenceDate: Date = new Date(),
): FinancialSummary {
  const start = startOfMonth(referenceDate)
  const end = endOfMonth(referenceDate)
  const startStr = start.toISOString()
  const endStr = end.toISOString()
  const period = format(referenceDate, 'yyyy-MM')

  const catMap = new Map(categories.map((c) => [c.id, c.name]))

  const monthly = transactions.filter(
    (tx) => tx.status !== 'cancelled' && tx.date >= startStr && tx.date <= endStr,
  )
  const income = monthly.filter((tx) => tx.type === 'income')
  const expenses = monthly.filter((tx) => tx.type === 'expense')

  const totalIncome = income.reduce((s, tx) => s + toBase(tx), 0)
  const totalExpenses = expenses.reduce((s, tx) => s + toBase(tx), 0)

  // Spending by category, sorted descending
  const byCatMap = new Map<string, number>()
  for (const tx of expenses) {
    byCatMap.set(tx.categoryId, (byCatMap.get(tx.categoryId) ?? 0) + toBase(tx))
  }
  const byCategory = Array.from(byCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId, amount]) => ({
      categoryId,
      label: catMap.get(categoryId) ?? categoryId,
      amount,
    }))

  // Budget status (synchronous approximation — no rollover)
  const budgetStatus = budgets
    .filter((b) => !b.endDate || b.endDate >= startStr)
    .map((b) => {
      const spent = expenses
        .filter((tx) => tx.categoryId === b.categoryId)
        .reduce((s, tx) => s + toBase(tx), 0)
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0
      return {
        categoryId: b.categoryId,
        label: catMap.get(b.categoryId) ?? b.categoryId,
        spent,
        limit: b.amount,
        pct,
      }
    })

  // Top recurring patterns from all history
  const allActive = transactions.filter((tx) => tx.status !== 'cancelled')
  const patterns = detectRecurringPatterns(allActive)
  const topRecurring = patterns.slice(0, 5).map((p) => ({
    label: catMap.get(p.categoryId) ?? p.categoryId,
    avgAmount: p.representativeAmount,
    frequency: `~day ${p.dayOfMonth} each month`,
  }))

  // Spending projection
  const daysInMonth = getDaysInMonth(referenceDate)
  const daysElapsed = Math.max(1, differenceInCalendarDays(referenceDate, start) + 1)
  const projectedMonthlyExpense = Math.round((totalExpenses / daysElapsed) * daysInMonth)

  return {
    period,
    baseCurrency,
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    byCategory,
    budgetStatus,
    topRecurring,
    projection: { projectedMonthlyExpense, daysElapsed },
  }
}

/**
 * Serialises the summary to a plain-text prompt payload.
 * This is the only content sent to the AI — never raw transactions or IDs.
 */
export function summaryToPrompt(summary: FinancialSummary): string {
  const fmt = (cents: number) => `${(cents / 100).toFixed(2)} ${summary.baseCurrency}`

  const lines: string[] = [
    `Financial Summary — ${summary.period}`,
    `Base currency: ${summary.baseCurrency}`,
    '',
    `Income:   ${fmt(summary.totalIncome)}`,
    `Expenses: ${fmt(summary.totalExpenses)}`,
    `Net:      ${fmt(summary.netCashFlow)}`,
  ]

  if (summary.byCategory.length > 0) {
    lines.push('', 'Spending by category:')
    for (const c of summary.byCategory) lines.push(`  ${c.label}: ${fmt(c.amount)}`)
  }

  if (summary.budgetStatus.length > 0) {
    lines.push('', 'Budget status:')
    for (const b of summary.budgetStatus) {
      lines.push(`  ${b.label}: ${b.pct}% used (${fmt(b.spent)} of ${fmt(b.limit)})`)
    }
  }

  if (summary.topRecurring.length > 0) {
    lines.push('', 'Recurring patterns:')
    for (const r of summary.topRecurring) {
      lines.push(`  ${r.label}: ~${fmt(r.avgAmount)}/month (${r.frequency})`)
    }
  }

  lines.push(
    '',
    `Month-end projection: ${fmt(summary.projection.projectedMonthlyExpense)}`,
    `(based on ${summary.projection.daysElapsed} days of data)`,
  )

  return lines.join('\n')
}
