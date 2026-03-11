import {
  startOfMonth,
  endOfMonth,
  subMonths,
  eachMonthOfInterval,
  format,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import type { Transaction, Account, Category } from '@/types'
import { convertToBase } from './currency'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportFilters {
  from: Date
  to: Date
  accountId?: string   // undefined = all accounts
  categoryId?: string  // undefined = all categories
}

export interface PeriodSummary {
  income: number   // base-currency cents
  expenses: number // base-currency cents
  net: number      // income - expenses
}

export interface MonthlyBar {
  month: string    // e.g. "Jan 26"
  income: number
  expenses: number
  net: number
}

export interface CategorySlice {
  categoryId: string
  name: string
  icon: string
  amount: number  // cents
  percent: number // 0–100
}

export interface AccountBalance {
  accountId: string
  name: string
  currency: string
  openingBalance: number  // cents
  totalIncome: number
  totalExpenses: number
  closingBalance: number
  vsLastMonth: number     // delta cents vs previous month's closing
  byCategory: CategorySlice[]
}

export interface CashFlowRow {
  month: string
  inflow: number
  outflow: number
  cumulative: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toBase(t: Transaction): number {
  return t.exchangeRate ? convertToBase(t.amount, t.exchangeRate) : t.amount
}

function txInRange(t: Transaction, from: Date, to: Date): boolean {
  const d = parseISO(t.date)
  return isWithinInterval(d, { start: from, end: to })
}

// ─── Summaries ────────────────────────────────────────────────────────────────

export function computePeriodSummary(
  transactions: Transaction[],
  filters: ReportFilters,
): PeriodSummary {
  const filtered = transactions.filter((t) => {
    if (!txInRange(t, filters.from, filters.to)) return false
    if (filters.accountId && t.accountId !== filters.accountId) return false
    return true
  })

  const income = filtered
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + toBase(t), 0)

  const expenses = filtered
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + toBase(t), 0)

  return { income, expenses, net: income - expenses }
}

// ─── Monthly trend (bar chart) ───────────────────────────────────────────────

export function computeMonthlyTrend(
  transactions: Transaction[],
  months = 6,
  accountId?: string,
): MonthlyBar[] {
  const today = new Date()
  const start = startOfMonth(subMonths(today, months - 1))
  const end = endOfMonth(today)
  const intervals = eachMonthOfInterval({ start, end })

  return intervals.map((monthDate) => {
    const mStart = startOfMonth(monthDate)
    const mEnd = endOfMonth(monthDate)

    const relevant = transactions.filter((t) => {
      if (!txInRange(t, mStart, mEnd)) return false
      if (accountId && t.accountId !== accountId) return false
      return true
    })

    const income = relevant
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + toBase(t), 0)

    const expenses = relevant
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + toBase(t), 0)

    return {
      month: format(monthDate, 'MMM yy'),
      income,
      expenses,
      net: income - expenses,
    }
  })
}

// ─── Category breakdown (pie / list) ──────────────────────────────────────────

export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  filters: ReportFilters,
  type: 'expense' | 'income' = 'expense',
): CategorySlice[] {
  const filtered = transactions.filter((t) => {
    if (t.type !== type) return false
    if (!txInRange(t, filters.from, filters.to)) return false
    if (filters.accountId && t.accountId !== filters.accountId) return false
    return true
  })

  const totals = new Map<string, number>()
  for (const t of filtered) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + toBase(t))
  }

  const grand = Array.from(totals.values()).reduce((s, v) => s + v, 0)

  return Array.from(totals.entries())
    .map(([categoryId, amount]) => {
      const cat = categories.find((c) => c.id === categoryId)
      return {
        categoryId,
        name: cat?.name ?? categoryId,
        icon: cat?.icon ?? 'circle',
        amount,
        percent: grand > 0 ? Math.round((amount / grand) * 100) : 0,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

// ─── Balance sheet by account ─────────────────────────────────────────────────

export function computeAccountBalances(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  filters: ReportFilters,
): AccountBalance[] {
  const prevMonthEnd = endOfMonth(subMonths(filters.from, 1))

  return accounts.map((account) => {
    // All transactions for this account ever up to end of period
    const allForAccount = transactions.filter((t) => t.accountId === account.id)

    // Transactions in current period
    const inPeriod = allForAccount.filter((t) => txInRange(t, filters.from, filters.to))

    const totalIncome = inPeriod
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)

    const totalExpenses = inPeriod
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    // Closing balance = opening + all income - all expenses up through period end
    const allUpToPeriodEnd = allForAccount.filter((t) =>
      parseISO(t.date) <= filters.to,
    )
    const cumulativeNet = allUpToPeriodEnd.reduce((s, t) => {
      if (t.type === 'income') return s + t.amount
      if (t.type === 'expense') return s - t.amount
      return s
    }, 0)
    const closingBalance = account.openingBalance + cumulativeNet

    // Closing balance as of end of previous month (for delta)
    const allUpToPrevMonth = allForAccount.filter((t) =>
      parseISO(t.date) <= prevMonthEnd,
    )
    const prevNet = allUpToPrevMonth.reduce((s, t) => {
      if (t.type === 'income') return s + t.amount
      if (t.type === 'expense') return s - t.amount
      return s
    }, 0)
    const prevClosing = account.openingBalance + prevNet
    const vsLastMonth = closingBalance - prevClosing

    // Category breakdown for expenses in period
    const expensesByCategory = new Map<string, number>()
    inPeriod
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        expensesByCategory.set(t.categoryId, (expensesByCategory.get(t.categoryId) ?? 0) + t.amount)
      })

    const byCategory: CategorySlice[] = Array.from(expensesByCategory.entries())
      .map(([categoryId, amount]) => {
        const cat = categories.find((c) => c.id === categoryId)
        return {
          categoryId,
          name: cat?.name ?? categoryId,
          icon: cat?.icon ?? 'circle',
          amount,
          percent: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    return {
      accountId: account.id,
      name: account.name,
      currency: account.currency,
      openingBalance: account.openingBalance,
      totalIncome,
      totalExpenses,
      closingBalance,
      vsLastMonth,
      byCategory,
    }
  })
}

// ─── Cash flow (cumulative) ───────────────────────────────────────────────────

export function computeCashFlow(
  transactions: Transaction[],
  months = 6,
  accountId?: string,
): CashFlowRow[] {
  const trend = computeMonthlyTrend(transactions, months, accountId)
  let cumulative = 0
  return trend.map((m) => {
    cumulative += m.net
    return {
      month: m.month,
      inflow: m.income,
      outflow: m.expenses,
      cumulative,
    }
  })
}
