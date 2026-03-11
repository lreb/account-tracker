import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatCurrency } from '@/lib/currency'
import { computePeriodSummary, computeMonthlyTrend, type ReportFilters } from '@/lib/reports'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { budgets } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

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

  const summary = useMemo(() => computePeriodSummary(transactions, thisMonthFilters), [transactions, thisMonthFilters])
  const lastMonth = useMemo(() => computePeriodSummary(transactions, lastMonthFilters), [transactions, lastMonthFilters])
  const trend = useMemo(() => computeMonthlyTrend(transactions, 6), [transactions])

  // Net worth: sum of all account closing balances
  const netWorth = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const accTx = transactions.filter((t) => t.accountId === acc.id)
      const net = accTx.reduce((s, t) => {
        if (t.type === 'income') return s + t.amount
        if (t.type === 'expense') return s - t.amount
        return s
      }, 0)
      return sum + acc.openingBalance + net
    }, 0)
  }, [accounts, transactions])

  // Recent transactions (last 5)
  const recent = useMemo(() => transactions.slice(0, 5), [transactions])

  // Budget health: top 3 budgets by percent used
  const topBudgets = useMemo(() => {
    const startStr = startOfMonth(now).toISOString()
    const endStr = endOfMonth(now).toISOString()
    return budgets.slice(0, 3).map((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.categoryId === b.categoryId && t.date >= startStr && t.date <= endStr)
        .reduce((s, t) => s + t.amount, 0)
      const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0
      const cat = categories.find((c) => c.id === b.categoryId)
      return { budget: b, spent, percent, catName: cat?.name ?? b.categoryId }
    })
  }, [budgets, transactions, categories])

  const incDelta = summary.income - lastMonth.income
  const expDelta = summary.expenses - lastMonth.expenses

  return (
    <div className="p-4 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
            {format(now, 'MMMM yyyy')}
          </p>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        </div>
      </div>

      {/* ── Net worth ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 text-white shadow-sm">
        <p className="text-xs uppercase tracking-widest opacity-75">Net Worth</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(netWorth, baseCurrency)}</p>
        <p className="text-xs opacity-60 mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── This month summary ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Income</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(summary.income, baseCurrency)}</p>
          <div className={`flex items-center gap-1 text-xs mt-1 ${incDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
            {incDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {incDelta >= 0 ? '+' : ''}{formatCurrency(incDelta, baseCurrency)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
          <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(summary.expenses, baseCurrency)}</p>
          <div className={`flex items-center gap-1 text-xs mt-1 ${expDelta <= 0 ? 'text-green-500' : 'text-red-400'}`}>
            {expDelta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {expDelta >= 0 ? '+' : ''}{formatCurrency(expDelta, baseCurrency)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Net this month</p>
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
      {transactions.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">6-Month Trend</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={trend} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: number, name: string) => [formatCurrency(v, baseCurrency), name]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Bar dataKey="income" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Budget health ─────────────────────────────────────────────── */}
      {topBudgets.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Budget Health</p>
            <Link to="/budgets" className="text-xs text-indigo-600 hover:underline">View all</Link>
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
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Recent</p>
            <Link to="/transactions" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
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

      {transactions.length === 0 && (
        <div className="text-center mt-10 space-y-3">
          <p className="text-sm text-gray-400">No transactions yet.</p>
          <Link to="/transactions/new">
            <Button size="sm">Add your first transaction</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

