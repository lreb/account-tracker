import {
  startOfMonth,
  endOfMonth,
  subMonths,
  eachMonthOfInterval,
  format,
} from 'date-fns'
import type { Transaction, Account, Category, Label } from '@/types'
import { getVisibleAccounts, isTransactionForVisiblePrimaryAccount } from './accounts'
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

// Compare ISO strings lexically — avoids parseISO() per transaction (best practice: strings for storage/sort, parse once for math)
function txInRange(t: Transaction, fromISO: string, toISO: string): boolean {
  return t.date >= fromISO && t.date <= toISO
}

// ─── Summaries ────────────────────────────────────────────────────────────────

export function computePeriodSummary(
  transactions: Transaction[],
  filters: ReportFilters,
  visibleAccountIds?: Set<string>,
): PeriodSummary {
  // Parse Date boundaries once — reuse ISO strings inside the filter loop
  const fromISO = filters.from.toISOString()
  const toISO   = filters.to.toISOString()
  const filtered = transactions.filter((t) => {
    if (!txInRange(t, fromISO, toISO)) return false
    if (visibleAccountIds && !isTransactionForVisiblePrimaryAccount(t, visibleAccountIds)) return false
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
  visibleAccountIds?: Set<string>,
): MonthlyBar[] {
  const today = new Date()
  const start = startOfMonth(subMonths(today, months - 1))
  const end = endOfMonth(today)
  const intervals = eachMonthOfInterval({ start, end })

  return intervals.map((monthDate) => {
    const mStart = startOfMonth(monthDate)
    const mEnd   = endOfMonth(monthDate)
    // Convert to ISO once per month interval — not per transaction
    const mStartISO = mStart.toISOString()
    const mEndISO   = mEnd.toISOString()
    const relevant = transactions.filter((t) => {
      if (!txInRange(t, mStartISO, mEndISO)) return false
      if (visibleAccountIds && !isTransactionForVisiblePrimaryAccount(t, visibleAccountIds)) return false
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
  visibleAccountIds?: Set<string>,
): CategorySlice[] {
  const fromISO = filters.from.toISOString()
  const toISO   = filters.to.toISOString()
  const filtered = transactions.filter((t) => {
    if (t.type !== type) return false
    if (!txInRange(t, fromISO, toISO)) return false
    if (visibleAccountIds && !isTransactionForVisiblePrimaryAccount(t, visibleAccountIds)) return false
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
  // Pre-compute ISO strings once outside the account loop (best practice: parse once, reuse)
  const fromISO        = filters.from.toISOString()
  const toISO          = filters.to.toISOString()
  const prevMonthEndISO = prevMonthEnd.toISOString()
  const visibleAccounts = getVisibleAccounts(accounts)

  return visibleAccounts.map((account) => {
    // All transactions for this account ever up to end of period.
    // Transfers appear from BOTH sides: as source (accountId) and destination (toAccountId).
    const allForAccount = transactions.filter(
      (t) =>
        t.accountId === account.id ||
        (t.type === 'transfer' && t.toAccountId === account.id),
    )

    // Transactions in current period
    const inPeriod = allForAccount.filter((t) => txInRange(t, fromISO, toISO))

    const totalIncome = inPeriod
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)

    const totalExpenses = inPeriod
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    const applyTransaction = (s: number, t: Transaction): number => {
      if (t.type === 'income') return s + t.amount
      if (t.type === 'expense') return s - t.amount
      if (t.type === 'transfer') {
        // Outgoing: this account is the source
        if (t.accountId === account.id) return s - t.amount
        // Incoming: this account is the destination
        return s + t.amount
      }
      return s
    }

    // Closing balance = opening + all movements up through period end
    const allUpToPeriodEnd = allForAccount.filter((t) =>
      t.date <= toISO,
    )
    const cumulativeNet = allUpToPeriodEnd.reduce(applyTransaction, 0)
    const closingBalance = account.openingBalance + cumulativeNet

    // Closing balance as of end of previous month (for delta)
    const allUpToPrevMonth = allForAccount.filter((t) =>
      t.date <= prevMonthEndISO,
    )
    const prevNet = allUpToPrevMonth.reduce(applyTransaction, 0)
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
  visibleAccountIds?: Set<string>,
): CashFlowRow[] {
  const trend = computeMonthlyTrend(transactions, months, accountId, visibleAccountIds)
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

// ─── Label breakdown ──────────────────────────────────────────────────────────

export interface LabelSlice {
  labelId: string          // '_none' for untagged
  name: string
  color: string
  income: number
  expenses: number
  net: number
  txCount: number
  percent: number          // share of total expenses (0–100)
}

/**
 * Aggregates transactions by label.  A transaction with multiple labels is
 * counted once per label (intentional — labels are independent dimensions).
 * Unlabelled transactions are grouped under the synthetic '_none' bucket.
 */
export function computeLabelBreakdown(
  transactions: Transaction[],
  labels: Label[],
  filters: ReportFilters,
  visibleAccountIds?: Set<string>,
  untaggedLabel = 'Untagged',
): LabelSlice[] {
  const fromISO = filters.from.toISOString()
  const toISO   = filters.to.toISOString()
  const filtered = transactions.filter((t) => {
    if (!txInRange(t, fromISO, toISO)) return false
    if (visibleAccountIds && !isTransactionForVisiblePrimaryAccount(t, visibleAccountIds)) return false
    if (filters.accountId && t.accountId !== filters.accountId) return false
    return true
  })

  // Build a map: labelId → { income, expenses, net, txCount }
  interface Acc { income: number; expenses: number; txCount: number }
  const map = new Map<string, Acc>()

  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, { income: 0, expenses: 0, txCount: 0 })
    return map.get(id)!
  }

  for (const t of filtered) {
    const labelIds = t.labels && t.labels.length > 0 ? t.labels : ['_none']
    for (const lid of labelIds) {
      const acc = ensure(lid)
      acc.txCount++
      if (t.type === 'income')  acc.income   += toBase(t)
      if (t.type === 'expense') acc.expenses += toBase(t)
    }
  }

  const totalExpenses = Array.from(map.values()).reduce((s, v) => s + v.expenses, 0)

  const labelMap = new Map(labels.map((l) => [l.id, l]))

  return Array.from(map.entries())
    .map(([labelId, acc]) => {
      const label = labelMap.get(labelId)
      return {
        labelId,
        name:    labelId === '_none' ? untaggedLabel : (label?.name ?? labelId),
        color:   labelId === '_none' ? '#9ca3af'  : (label?.color ?? '#6366f1'),
        income:   acc.income,
        expenses: acc.expenses,
        net:      acc.income - acc.expenses,
        txCount:  acc.txCount,
        percent:  totalExpenses > 0 ? Math.round((acc.expenses / totalExpenses) * 100) : 0,
      }
    })
    .sort((a, b) => b.expenses - a.expenses)
}

// ─── 50/30/20 rule ───────────────────────────────────────────────────────────

export interface BucketSummary {
  label: string      // label name used for this bucket
  labelId: string
  color: string
  expenses: number   // total expenses cents
  income: number     // total income cents
  txCount: number
}

/**
 * Returns per-label totals for expenses and income, in the same structure as
 * LabelSlice but without percents — the caller decides how to present the
 * 50/30/20 targets.
 *
 * The three canonical bucket labelIds (by convention) are any labels whose
 * names contain "needs", "wants", or "savings" (case-insensitive).
 * If none are found, returns all labels so the user can still see their
 * spending distribution.
 */
export function compute503020(
  transactions: Transaction[],
  labels: Label[],
  filters: ReportFilters,
  visibleAccountIds?: Set<string>,
): {
  buckets: BucketSummary[]
  totalIncome: number
  totalExpenses: number
} {
  const slices = computeLabelBreakdown(transactions, labels, filters, visibleAccountIds)
  const totalIncome   = slices.reduce((s, l) => s + l.income, 0)
  const totalExpenses = slices.reduce((s, l) => s + l.expenses, 0)

  // Exclude the synthetic 'untagged' bucket from the rule view
  const buckets = slices
    .filter((s) => s.labelId !== '_none')
    .map((s) => ({
      label:    s.name,
      labelId:  s.labelId,
      color:    s.color,
      expenses: s.expenses,
      income:   s.income,
      txCount:  s.txCount,
    }))

  return { buckets, totalIncome, totalExpenses }
}
