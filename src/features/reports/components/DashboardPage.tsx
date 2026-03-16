import { useMemo, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  getVisibleAccountIds,
  getVisibleAccounts,
  isTransactionForVisiblePrimaryAccount,
} from '@/lib/accounts'
import { formatCurrency } from '@/lib/currency'
import { computePeriodSummary, computeMonthlyTrend, compute503020, type ReportFilters } from '@/lib/reports'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { transactions: rawTransactions } = useTransactionsStore()
  const transactions = useDeferredValue(rawTransactions)
  const isComputing = rawTransactions !== transactions
  const { accounts } = useAccountsStore()
  const { budgets } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  const { labels } = useLabelsStore()
  const { baseCurrency } = useSettingsStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])
  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])
  const visibleTransactions = useMemo(
    () => transactions.filter((transaction) => isTransactionForVisiblePrimaryAccount(transaction, visibleAccountIds)),
    [transactions, visibleAccountIds],
  )

  const now = new Date()

  // This month
  const thisMonthFilters: ReportFilters = useMemo(() => ({
    from: startOfMonth(now),
    to: endOfMonth(now),
  }), [])

  // Last month (for delta)
  const lastMonthFilters: ReportFilters = useMemo(() => {
    const lm = subMonths(now, 1)
    return { from: startOfMonth(lm), to: endOfMonth(lm) }
  }, [])

  const summary = useMemo(
    () => computePeriodSummary(transactions, thisMonthFilters, visibleAccountIds),
    [transactions, thisMonthFilters, visibleAccountIds],
  )
  const lastMonth = useMemo(
    () => computePeriodSummary(transactions, lastMonthFilters, visibleAccountIds),
    [transactions, lastMonthFilters, visibleAccountIds],
  )
  const trend = useMemo(
    () => computeMonthlyTrend(transactions, 6, undefined, visibleAccountIds),
    [transactions, visibleAccountIds],
  )

  // Net worth: sum of all account closing balances
  const netWorth = useMemo(() => {
    return visibleAccounts.reduce((sum, acc) => {
      const accTx = transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
      const net = accTx.reduce((s, t) => {
        if (t.type === 'income') return s + t.amount
        if (t.type === 'expense') return s - t.amount
        if (t.type === 'transfer') {
          if (t.accountId === acc.id) return s - t.amount
          return s + (t.originalAmount ?? t.amount)
        }
        return s
      }, 0)
      return sum + acc.openingBalance + net
    }, 0)
  }, [visibleAccounts, transactions])

  // Recent transactions (last 5)
  const recent = useMemo(() => visibleTransactions.slice(0, 5), [visibleTransactions])

  // 50/30/20 — only render when user has labelled transactions this month
  const rule503020 = useMemo(
    () => compute503020(transactions, labels, thisMonthFilters, visibleAccountIds),
    [transactions, labels, thisMonthFilters, visibleAccountIds],
  )

  // Budget health: top 3 budgets by percent used
  const topBudgets = useMemo(() => {
    const startStr = startOfMonth(now).toISOString()
    const endStr = endOfMonth(now).toISOString()
    return budgets.slice(0, 3).map((b) => {
      const spent = transactions
        .filter((t) => (
          t.type === 'expense'
          && visibleAccountIds.has(t.accountId)
          && t.categoryId === b.categoryId
          && t.date >= startStr
          && t.date <= endStr
        ))
        .reduce((s, t) => s + t.amount, 0)
      const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0
      const cat = categories.find((c) => c.id === b.categoryId)
      return { budget: b, spent, percent, catName: cat?.name ?? b.categoryId }
    })
  }, [budgets, transactions, categories, visibleAccountIds])

  const incDelta = summary.income - lastMonth.income
  const expDelta = summary.expenses - lastMonth.expenses

  return (
    <div className="p-4 pb-24 space-y-5">
      {isComputing && (
        <div className="fixed top-14 right-4 z-50 flex items-center gap-1.5 rounded-full bg-white/90 border shadow-sm px-2.5 py-1 text-xs text-gray-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          Calculating…
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
            {format(now, 'MMMM yyyy')}
          </p>
          <h1 className="text-xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
        </div>
      </div>

      {/* ── Net worth ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 text-white shadow-sm">
        <p className="text-xs uppercase tracking-widest opacity-75">{t('dashboard.netWorth')}</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(netWorth, baseCurrency)}</p>
        <p className="text-xs opacity-60 mt-1">{visibleAccounts.length} {visibleAccounts.length !== 1 ? t('dashboard.accounts') : t('dashboard.account')}</p>
      </div>

      {/* ── This month summary ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.income')}</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(summary.income, baseCurrency)}</p>
          <div className={`flex items-center gap-1 text-xs mt-1 ${incDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
            {incDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {incDelta >= 0 ? '+' : ''}{formatCurrency(incDelta, baseCurrency)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.expenses')}</p>
          <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(summary.expenses, baseCurrency)}</p>
          <div className={`flex items-center gap-1 text-xs mt-1 ${expDelta <= 0 ? 'text-green-500' : 'text-red-400'}`}>
            {expDelta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {expDelta >= 0 ? '+' : ''}{formatCurrency(expDelta, baseCurrency)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.netThisMonth')}</p>
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

      {/* ── 6-month trend mini chart ──────────────────────────────────── */}
      {visibleTransactions.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">{t('dashboard.sixMonthTrend')}</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={trend} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (typeof value !== 'number') {
                    return ['', name]
                  }

                  return [formatCurrency(value, baseCurrency), name]
                }}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Bar dataKey="income" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 50/30/20 widget (only when user has labelled transactions) ──── */}
      {rule503020.buckets.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('dashboard.overview503020')}</p>
            <Link to="/reports" className="text-xs text-indigo-600 hover:underline">{t('dashboard.details')}</Link>
          </div>
          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden w-full gap-px">
            {rule503020.buckets.map((b) => {
              const w = rule503020.totalIncome > 0
                ? Math.round((b.expenses / rule503020.totalIncome) * 100)
                : 0
              return w > 0 ? (
                <div
                  key={b.labelId}
                  className="h-full"
                  style={{ width: `${w}%`, background: b.color }}
                  title={`${b.label}: ${w}% of income`}
                />
              ) : null
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {rule503020.buckets.map((b) => {
              const pct = rule503020.totalIncome > 0
                ? Math.round((b.expenses / rule503020.totalIncome) * 100)
                : 0
              return (
                <div key={b.labelId} className="flex items-center gap-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                  <span className="text-gray-500">{b.label}</span>
                  <span className="font-semibold text-gray-800">{pct}%</span>
                  <span className="text-gray-400 text-[10px]">({formatCurrency(b.expenses, baseCurrency)})</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Budget health ─────────────────────────────────────────────── */}
      {topBudgets.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('dashboard.budgetHealth')}</p>
            <Link to="/budgets" className="text-xs text-indigo-600 hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          {topBudgets.map(({ budget, spent, percent, catName }) => (
            <div key={budget.id} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-700">
                <span className="truncate">{catName}</span>
                <span className={percent >= 100 ? 'text-red-500 font-semibold' : percent >= 75 ? 'text-amber-500' : 'text-gray-500'}>
                  {percent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percent >= 100 ? 'bg-red-500' : percent >= 75 ? 'bg-amber-400' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400">
                {formatCurrency(spent, baseCurrency)} / {formatCurrency(budget.amount, baseCurrency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent transactions ───────────────────────────────────────── */}
      {recent.length > 0 && (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('dashboard.recent')}</p>
            <Link to="/transactions" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              {t('dashboard.viewAll')} <ArrowRight size={11} />
            </Link>
          </div>
          <ul className="divide-y">
            {recent.map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId)
              const acc = accounts.find((a) => a.id === tx.accountId)
              return (
                <li key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-800">{tx.description}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {cat?.name ?? '—'} · {acc?.name ?? '—'} · {format(new Date(tx.date), 'MMM d')}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${
                    tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
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

