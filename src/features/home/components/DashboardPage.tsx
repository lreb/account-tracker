import { useMemo, useDeferredValue, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  getActiveAccounts,
  getActiveAccountIds,
  isTransactionForVisiblePrimaryAccount,
} from '@/lib/accounts'
import { formatCurrency } from '@/lib/currency'
import { db } from '@/db'
import { computePeriodSummary, computeMonthlyTrend, type ReportFilters } from '@/lib/reports'
import { Button } from '@/components/ui/button'
import { DashboardTrendChart } from './DashboardTrendChart'
import type { TrendPeriod } from './DashboardTrendChart.types'
import { DashboardBudgetHealth } from './DashboardBudgetHealth'
import { DashboardRecentTransactions } from './DashboardRecentTransactions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ComputingOverlay } from '@/components/ui/computing-overlay'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { transactions: rawTransactions, load: loadTransactions } = useTransactionsStore()
  // Reload the full transaction history on every mount.
  // TransactionListPage purposely loads a date-filtered subset into this same
  // store; without this reload the net worth would only reflect recent transactions.
  useEffect(() => { void loadTransactions() }, [loadTransactions])
  // Exclude cancelled transactions at the source — affects every calculation.
  const rawNonCancelled = useMemo(
    () => rawTransactions.filter((t) => t.status !== 'cancelled'),
    [rawTransactions],
  )
  const transactions = useDeferredValue(rawNonCancelled)
  const isComputing = rawNonCancelled !== transactions
  const { accounts } = useAccountsStore()
  const { budgets } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const activeAccounts = useMemo(() => getActiveAccounts(accounts), [accounts])
  const activeAccountIds = useMemo(() => getActiveAccountIds(accounts), [accounts])
  // Only show transactions from active (non-hidden, non-cancelled) accounts.
  const visibleTransactions = useMemo(
    () => transactions.filter((transaction) => isTransactionForVisiblePrimaryAccount(transaction, activeAccountIds)),
    [transactions, activeAccountIds],
  )

  // Stable session-start date — set once on mount, never changes across re-renders
  // or back-navigation, so date-boundary memos don't drift mid-session.
  const [now] = useState(() => new Date())

  // ── Period pickers ───────────────────────────────────────────────────────
  type SummaryPeriod = 'this_month' | 'last_month' | 'last_quarter' | 'last_6m' | 'last_year' | 'all'

  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>('this_month')
  const [trendPeriod,   setTrendPeriod]   = useState<TrendPeriod>('6m')

  const summaryPeriodLabels: Record<SummaryPeriod, string> = {
    this_month:   t('dashboard.period.thisMonth'),
    last_month:   t('dashboard.period.lastMonth'),
    last_quarter: t('dashboard.period.lastQuarter'),
    last_6m:      t('dashboard.period.last6m'),
    last_year:    t('dashboard.period.lastYear'),
    all:          t('dashboard.period.all'),
  }

  // Map summary period → { current, prev } ReportFilters.
  // prev is null for 'all' (no meaningful comparison period).
  const { summaryFilters, prevFilters } = useMemo((): {
    summaryFilters: ReportFilters
    prevFilters: ReportFilters | null
  } => {
    switch (summaryPeriod) {
      case 'this_month':
        return {
          summaryFilters: { from: startOfMonth(now), to: endOfMonth(now) },
          prevFilters:    { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
        }
      case 'last_month': {
        const lm = subMonths(now, 1)
        return {
          summaryFilters: { from: startOfMonth(lm), to: endOfMonth(lm) },
          prevFilters:    { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(subMonths(now, 2)) },
        }
      }
      case 'last_quarter':
        return {
          summaryFilters: { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) },
          prevFilters:    { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(subMonths(now, 3)) },
        }
      case 'last_6m':
        return {
          summaryFilters: { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) },
          prevFilters:    { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(subMonths(now, 6)) },
        }
      case 'last_year':
        return {
          summaryFilters: { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(now) },
          prevFilters:    { from: startOfMonth(subMonths(now, 23)), to: endOfMonth(subMonths(now, 12)) },
        }
      case 'all':
      default:
        return {
          summaryFilters: { from: new Date(0), to: now },
          prevFilters:    null,
        }
    }
  }, [summaryPeriod, now])

  const trendMonths = trendPeriod === '3m' ? 3 : trendPeriod === '6m' ? 6 : trendPeriod === '1y' ? 12 : 24

  const summary = useMemo(
    () => computePeriodSummary(transactions, summaryFilters, activeAccountIds),
    [transactions, summaryFilters, activeAccountIds],
  )
  const prevSummary = useMemo(
    () => prevFilters
      ? computePeriodSummary(transactions, prevFilters, activeAccountIds)
      : null,
    [transactions, prevFilters, activeAccountIds],
  )
  const trend = useMemo(
    () => computeMonthlyTrend(transactions, trendMonths, undefined, activeAccountIds),
    [transactions, trendMonths, activeAccountIds],
  )

  const [netWorth, setNetWorth] = useState(0)
  // Query Dexie directly — completely bypasses the shared transactions store
  // and any date-range filter another page (e.g. TransactionListPage) may have
  // loaded into it. Re-runs whenever accounts change or any store mutation
  // touches rawTransactions (add / update / remove).
  useEffect(() => {
    db.transactions
      .filter((t) => t.status !== 'cancelled')
      .toArray()
      .then((allTx) => {
        setNetWorth(
          activeAccounts.reduce((sum, acc) => {
            const net = allTx
              .filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
              .reduce((s, t) => {
                if (t.type === 'income') return s + t.amount
                if (t.type === 'expense') return s - t.amount
                if (t.type === 'transfer') {
                  if (t.accountId === acc.id) return s - t.amount
                  return s + (t.originalAmount ?? t.amount)
                }
                return s
              }, 0)
            return sum + acc.openingBalance + net
          }, 0),
        )
      })
      .catch(console.error)
  }, [activeAccounts, rawTransactions])

  // Recent transactions (last 5)
  const recent = useMemo(() => visibleTransactions.slice(0, 5), [visibleTransactions])

  // 50/30/20 — keep anchored to current calendar month (not the summary period filter)
  // Budget health: top 3 budgets by percent used, anchored to current month
  const topBudgets = useMemo(() => {
    const startStr = startOfMonth(now).toISOString()
    const endStr = endOfMonth(now).toISOString()
    return budgets.slice(0, 3).map((b) => {
      const spent = transactions
        .filter((t) => (
          t.type === 'expense'
          && activeAccountIds.has(t.accountId)
          && t.categoryId === b.categoryId
          && t.date >= startStr
          && t.date <= endStr
        ))
        .reduce((s, t) => s + t.amount, 0)
      const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0
      const cat = categories.find((c) => c.id === b.categoryId)
      return { budget: b, spent, percent, catName: cat?.name ?? b.categoryId }
    })
  }, [budgets, transactions, categories, activeAccountIds, now])

  const incDelta = prevSummary !== null ? summary.income - prevSummary.income : null
  const expDelta = prevSummary !== null ? summary.expenses - prevSummary.expenses : null

  return (
    <div className="p-4 pb-24 space-y-5">
      <ComputingOverlay visible={isComputing} />
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
          {format(now, 'MMMM yyyy')}
        </p>
        <h1 className="text-xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
      </div>

      {/* ── Net worth ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 text-white shadow-sm">
        <p className="text-xs uppercase tracking-widest opacity-75">{t('dashboard.netWorth')}</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(netWorth, baseCurrency)}</p>
        <p className="text-xs opacity-60 mt-1">{activeAccounts.length} {activeAccounts.length !== 1 ? t('dashboard.accounts') : t('dashboard.account')}</p>
      </div>

      {/* ── Summary period picker + income/expenses/net ──────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Select value={summaryPeriod} onValueChange={(v) => setSummaryPeriod(v as SummaryPeriod)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue>{summaryPeriodLabels[summaryPeriod]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{t('dashboard.period.thisMonth')}</SelectItem>
              <SelectItem value="last_month">{t('dashboard.period.lastMonth')}</SelectItem>
              <SelectItem value="last_quarter">{t('dashboard.period.lastQuarter')}</SelectItem>
              <SelectItem value="last_6m">{t('dashboard.period.last6m')}</SelectItem>
              <SelectItem value="last_year">{t('dashboard.period.lastYear')}</SelectItem>
              <SelectItem value="all">{t('dashboard.period.all')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.income')}</p>
            <p className="text-m font-bold text-green-600 mt-1">{formatCurrency(summary.income, baseCurrency)}</p>
            {incDelta !== null && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${incDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                {incDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {incDelta >= 0 ? '+' : ''}{formatCurrency(incDelta, baseCurrency)}
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.expenses')}</p>
            <p className="text-m font-bold text-red-500 mt-1">{formatCurrency(summary.expenses, baseCurrency)}</p>
            {expDelta !== null && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${expDelta <= 0 ? 'text-green-500' : 'text-red-400'}`}>
                {expDelta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                {expDelta >= 0 ? '+' : ''}{formatCurrency(expDelta, baseCurrency)}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.netPeriod')}</p>
            <p className={`text-2xl font-bold mt-1 ${summary.net >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
              {formatCurrency(summary.net, baseCurrency)}
            </p>
          </div>
          <Link to="/reports">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              Full report <ArrowRight size={12} />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Trend chart with its own period picker ───────────────────── */}
      {visibleTransactions.length > 0 && (
        <DashboardTrendChart
          trend={trend}
          trendPeriod={trendPeriod}
          baseCurrency={baseCurrency}
          onPeriodChange={setTrendPeriod}
        />
      )}

      {/* ── Budget health ─────────────────────────────────────────────── */}
      {topBudgets.length > 0 && (
        <DashboardBudgetHealth
          topBudgets={topBudgets}
          baseCurrency={baseCurrency}
        />
      )}

      {/* ── Recent transactions ───────────────────────────────────────── */}
      {recent.length > 0 && (
        <DashboardRecentTransactions
          recent={recent}
          accounts={accounts}
          categories={categories}
        />
      )}

      {visibleTransactions.length === 0 && (
        <div className="text-center mt-10 space-y-3">
          <p className="text-sm text-gray-400">{t('dashboard.noTransactions')}</p>
          <Link to="/transactions/new">
            <Button size="sm">{t('dashboard.addFirstTransaction')}</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

