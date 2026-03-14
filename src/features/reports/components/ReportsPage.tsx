import { useEffect, useMemo, useState, useDeferredValue } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'

import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getVisibleAccountIds, getVisibleAccounts } from '@/lib/accounts'
import { formatCurrency } from '@/lib/currency'
import {
  computePeriodSummary,
  computeMonthlyTrend,
  computeCategoryBreakdown,
  computeAccountBalances,
  computeCashFlow,
  computeLabelBreakdown,
  compute503020,
  type ReportFilters,
} from '@/lib/reports'
import { CategoryIcon } from '@/lib/icon-map'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

type PresetKey = 'thisMonth' | 'lastMonth' | 'last3' | 'last6' | 'thisYear' | 'custom'

function getPresetRange(key: PresetKey): { from: Date; to: Date } {
  const today = new Date()
  switch (key) {
    case 'thisMonth':  return { from: startOfMonth(today),           to: endOfMonth(today) }
    case 'lastMonth': {
      const lm = subMonths(today, 1)
      return { from: startOfMonth(lm),             to: endOfMonth(lm) }
    }
    case 'last3':      return { from: startOfMonth(subMonths(today, 2)), to: endOfMonth(today) }
    case 'last6':      return { from: startOfMonth(subMonths(today, 5)), to: endOfMonth(today) }
    case 'thisYear':   return { from: startOfYear(today),            to: endOfYear(today) }
    case 'custom':     return { from: startOfMonth(today),           to: endOfMonth(today) }
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">{children}</h2>
}

function StatCard({
  label,
  value,
  color,
  delta,
  currency,
}: {
  label: string
  value: number
  color: string
  delta?: number
  currency: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{formatCurrency(value, currency)}</p>
      {delta !== undefined && (
        <p className={`text-xs ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {delta >= 0 ? '+' : ''}{formatCurrency(delta, currency)} vs last month
        </p>
      )}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-gray-400">
      No data for selected period
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label, currency }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  currency: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-white shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-medium text-gray-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value, currency)}
        </p>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { transactions: rawTransactions } = useTransactionsStore()
  const transactions = useDeferredValue(rawTransactions)
  const isComputing = rawTransactions !== transactions
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { labels } = useLabelsStore()
  const { baseCurrency } = useSettingsStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])
  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])
  const hasData = useMemo(
    () => transactions.some((transaction) => visibleAccountIds.has(transaction.accountId)),
    [transactions, visibleAccountIds],
  )

  // ── Filter state ─────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<PresetKey>('thisMonth')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'category' | 'accounts' | 'cashflow' | 'labels'>('overview')
  const [labelView, setLabelView] = useState<'breakdown' | '503020'>('breakdown')

  useEffect(() => {
    if (filterAccount !== 'all' && !visibleAccounts.some((account) => account.id === filterAccount)) {
      setFilterAccount('all')
    }
  }, [filterAccount, visibleAccounts])

  const filters: ReportFilters = useMemo(() => {
    if (preset === 'custom') {
      return {
        from: new Date(customFrom),
        to: new Date(customTo),
        accountId: filterAccount === 'all' ? undefined : filterAccount,
      }
    }
    const { from, to } = getPresetRange(preset)
    return {
      from,
      to,
      accountId: filterAccount === 'all' ? undefined : filterAccount,
    }
  }, [preset, customFrom, customTo, filterAccount])

  // ── Derived data ─────────────────────────────────────────────────────────
  const summary = useMemo(
    () => computePeriodSummary(transactions, filters, visibleAccountIds),
    [transactions, filters, visibleAccountIds],
  )

  const lastMonthFilters: ReportFilters = useMemo(() => {
    const lm = subMonths(filters.from, 1)
    return { from: startOfMonth(lm), to: endOfMonth(lm), accountId: filters.accountId }
  }, [filters])
  const lastMonthSummary = useMemo(
    () => computePeriodSummary(transactions, lastMonthFilters, visibleAccountIds),
    [transactions, lastMonthFilters, visibleAccountIds],
  )

  const monthCount = preset === 'thisYear' ? 12 : preset === 'last6' ? 6 : preset === 'last3' ? 3 : 6
  const monthlyTrend = useMemo(
    () => computeMonthlyTrend(
      transactions,
      monthCount,
      filterAccount === 'all' ? undefined : filterAccount,
      visibleAccountIds,
    ),
    [transactions, monthCount, filterAccount, visibleAccountIds],
  )

  const expensesByCategory = useMemo(
    () => computeCategoryBreakdown(transactions, categories, filters, 'expense', visibleAccountIds),
    [transactions, categories, filters, visibleAccountIds],
  )
  const incomeByCategory = useMemo(
    () => computeCategoryBreakdown(transactions, categories, filters, 'income', visibleAccountIds),
    [transactions, categories, filters, visibleAccountIds],
  )

  const accountBalances = useMemo(
    () => computeAccountBalances(transactions, accounts, categories, filters),
    [transactions, accounts, categories, filters],
  )

  const cashFlow = useMemo(
    () => computeCashFlow(
      transactions,
      monthCount,
      filterAccount === 'all' ? undefined : filterAccount,
      visibleAccountIds,
    ),
    [transactions, monthCount, filterAccount, visibleAccountIds],
  )

  const labelBreakdown = useMemo(
    () => computeLabelBreakdown(transactions, labels, filters, visibleAccountIds),
    [transactions, labels, filters, visibleAccountIds],
  )

  const rule503020 = useMemo(
    () => compute503020(transactions, labels, filters, visibleAccountIds),
    [transactions, labels, filters, visibleAccountIds],
  )

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pb-24 space-y-5">
      {isComputing && (
        <div className="fixed top-14 right-4 z-50 flex items-center gap-1.5 rounded-full bg-white/90 border shadow-sm px-2.5 py-1 text-xs text-gray-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          Calculating…
        </div>
      )}
      <h1 className="text-xl font-bold">Reports</h1>

      {/* ── Period selector ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {(['thisMonth', 'lastMonth', 'last3', 'last6', 'thisYear', 'custom'] as PresetKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                preset === k
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
              }`}
            >
              {{ thisMonth: 'This month', lastMonth: 'Last month', last3: '3 months', last6: '6 months', thisYear: 'This year', custom: 'Custom' }[k]}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-xs" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-xs" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select value={filterAccount} onValueChange={(value) => setFilterAccount(value ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {visibleAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Income"
          value={summary.income}
          color="text-green-600"
          delta={summary.income - lastMonthSummary.income}
          currency={baseCurrency}
        />
        <StatCard
          label="Expenses"
          value={summary.expenses}
          color="text-red-500"
          delta={-(summary.expenses - lastMonthSummary.expenses)}
          currency={baseCurrency}
        />
        <StatCard
          label="Net"
          value={summary.net}
          color={summary.net >= 0 ? 'text-indigo-600' : 'text-orange-500'}
          delta={summary.net - lastMonthSummary.net}
          currency={baseCurrency}
        />
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap rounded-xl bg-gray-100 p-1">
        {(['overview', 'category', 'accounts', 'cashflow', 'labels'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {{ overview: 'Overview', category: 'Category', accounts: 'Accounts', cashflow: 'Cash Flow', labels: 'Labels' }[t]}
          </button>
        ))}
      </div>

      {/* ── Overview tab: monthly income vs expenses bar chart ───────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <SectionTitle>Monthly Income vs Expenses</SectionTitle>
            {!hasData ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${baseCurrency} ${(v / 100).toFixed(0)}`} width={70} />
                  <Tooltip content={<CurrencyTooltip currency={baseCurrency} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <SectionTitle>Net per Month</SectionTitle>
            {!hasData ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 100).toFixed(0)}`} width={54} />
                  <Tooltip content={<CurrencyTooltip currency={baseCurrency} />} />
                  <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}>
                    {monthlyTrend.map((entry, i) => (
                      <Cell key={i} fill={entry.net >= 0 ? '#6366f1' : '#f97316'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Category tab: pie + ranked list ─────────────────────────────── */}
      {activeTab === 'category' && (
        <div className="space-y-5">
          {/* Expenses by category */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <SectionTitle>Expenses by Category</SectionTitle>
            {expensesByCategory.length === 0 ? <EmptyChart /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${percent}%`}
                      labelLine={false}
                    >
                      {expensesByCategory.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value, baseCurrency) : ''} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-2 mt-2">
                  {expensesByCategory.map((slice, i) => (
                    <li key={slice.categoryId} className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <CategoryIcon name={slice.icon} size={14} className="text-gray-500 shrink-0" />
                      <span className="flex-1 text-sm text-gray-700 truncate">{slice.name}</span>
                      <span className="text-xs text-gray-400">{slice.percent}%</span>
                      <span className="text-sm font-medium">{formatCurrency(slice.amount, baseCurrency)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Income by category */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <SectionTitle>Income by Category</SectionTitle>
            {incomeByCategory.length === 0 ? <EmptyChart /> : (
              <ul className="space-y-2">
                {incomeByCategory.map((slice, i) => (
                  <li key={slice.categoryId} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <CategoryIcon name={slice.icon} size={14} className="text-gray-500 shrink-0" />
                    <span className="flex-1 text-sm text-gray-700 truncate">{slice.name}</span>
                    <span className="text-xs text-gray-400">{slice.percent}%</span>
                    <span className="text-sm font-medium text-green-600">{formatCurrency(slice.amount, baseCurrency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Accounts tab: balance sheet by account ───────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {visibleAccounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">No accounts yet.</p>
          ) : (
            accountBalances.map((ab) => (
              <div key={ab.accountId} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                {/* Account header */}
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{ab.name}</p>
                    <p className="text-xs text-gray-400">{ab.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-600">
                      {formatCurrency(ab.closingBalance, ab.currency)}
                    </p>
                    <p className={`text-xs ${ab.vsLastMonth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {ab.vsLastMonth >= 0 ? '+' : ''}{formatCurrency(ab.vsLastMonth, ab.currency)} vs last month
                    </p>
                  </div>
                </div>

                {/* Opening / Income / Expenses / Closing row */}
                <div className="grid grid-cols-4 divide-x text-center py-3">
                  {[
                    { label: 'Opening', value: ab.openingBalance, color: 'text-gray-700' },
                    { label: 'Income', value: ab.totalIncome, color: 'text-green-600' },
                    { label: 'Expenses', value: ab.totalExpenses, color: 'text-red-500' },
                    { label: 'Closing', value: ab.closingBalance, color: 'text-indigo-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${color}`}>
                        {formatCurrency(value, ab.currency)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Expenses by category (for this account) */}
                {ab.byCategory.length > 0 && (
                  <div className="px-4 pb-3 space-y-1.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Expenses by category</p>
                    {ab.byCategory.map((slice, i) => (
                      <div key={slice.categoryId} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <CategoryIcon name={slice.icon} size={12} className="text-gray-400 shrink-0" />
                          <span className="flex-1 text-xs text-gray-700 truncate">{slice.name}</span>
                          <span className="text-xs text-gray-400">{slice.percent}%</span>
                          <span className="text-xs font-medium">{formatCurrency(slice.amount, ab.currency)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden ml-5">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${slice.percent}%`,
                              background: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Labels tab ───────────────────────────────────────────────────── */}
      {activeTab === 'labels' && (
        <div className="space-y-5">
          {/* Sub-view toggle */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(['breakdown', '503020'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLabelView(v)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  labelView === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'breakdown' ? 'Breakdown' : '50/30/20 Rule'}
              </button>
            ))}
          </div>

          {/* ── Breakdown view ────────────────────────────────────────────── */}
          {labelView === 'breakdown' && (
            <div className="space-y-4">
              {labelBreakdown.length === 0 ? (
                <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-400">
                  No transactions in this period. Tag transactions with labels to see insights.
                </div>
              ) : (
                labelBreakdown.map((slice) => (
                  <div key={slice.labelId} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                    {/* Label header */}
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: slice.color }}
                      />
                      <span className="font-semibold text-sm text-gray-800">{slice.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{slice.txCount} transaction{slice.txCount !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Income / Expenses / Net row */}
                    <div className="grid grid-cols-3 divide-x rounded-xl bg-gray-50 overflow-hidden">
                      {([
                        { label: 'Income',   value: slice.income,   color: 'text-green-600' },
                        { label: 'Expenses', value: slice.expenses, color: 'text-red-500' },
                        { label: 'Net',      value: slice.net,      color: slice.net >= 0 ? 'text-indigo-600' : 'text-orange-500' },
                      ] as const).map(({ label, value, color }) => (
                        <div key={label} className="text-center py-3 px-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${color}`}>{formatCurrency(value, baseCurrency)}</p>
                        </div>
                      ))}
                    </div>
                    {/* Expense share bar */}
                    {slice.expenses > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Share of total expenses</span>
                          <span>{slice.percent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${slice.percent}%`, background: slice.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── 50/30/20 view ─────────────────────────────────────────────── */}
          {labelView === '503020' && (
            <div className="space-y-4">
              {/* Explainer */}
              <div className="rounded-2xl border bg-indigo-50 border-indigo-200 p-4 space-y-1">
                <p className="text-sm font-semibold text-indigo-800">50/30/20 Rule</p>
                <p className="text-xs text-indigo-600 leading-relaxed">
                  Tag your transactions with labels like <strong>Needs</strong>, <strong>Wants</strong>, and <strong>Savings</strong> to track your spending against this popular budgeting framework.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[{ label: 'Needs', target: '50%', color: 'bg-blue-100 text-blue-700' }, { label: 'Wants', target: '30%', color: 'bg-amber-100 text-amber-700' }, { label: 'Savings', target: '20%', color: 'bg-green-100 text-green-700' }].map((b) => (
                    <span key={b.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.color}`}>
                      {b.label} → {b.target}
                    </span>
                  ))}
                </div>
              </div>

              {rule503020.buckets.length === 0 ? (
                <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-400">
                  No labelled transactions in this period.
                </div>
              ) : (
                <>
                  {/* Stacked bar across total income */}
                  {rule503020.totalIncome > 0 && (
                    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                      <SectionTitle>Spending vs Income</SectionTitle>
                      <div className="flex h-5 rounded-full overflow-hidden w-full gap-px">
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
                      <div className="flex flex-wrap gap-2">
                        {rule503020.buckets.map((b) => {
                          const pct = rule503020.totalIncome > 0
                            ? Math.round((b.expenses / rule503020.totalIncome) * 100)
                            : 0
                          return (
                            <div key={b.labelId} className="flex items-center gap-1 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                              <span className="text-gray-600">{b.label}</span>
                              <span className="font-semibold text-gray-800">{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Total income: {formatCurrency(rule503020.totalIncome, baseCurrency)} · Total tagged expenses: {formatCurrency(rule503020.totalExpenses, baseCurrency)}
                      </p>
                    </div>
                  )}

                  {/* Per-bucket cards */}
                  {rule503020.buckets.map((b) => {
                    const pctOfIncome = rule503020.totalIncome > 0
                      ? Math.round((b.expenses / rule503020.totalIncome) * 100)
                      : 0
                    const pctOfExpenses = rule503020.totalExpenses > 0
                      ? Math.round((b.expenses / rule503020.totalExpenses) * 100)
                      : 0
                    return (
                      <div key={b.labelId} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.color }} />
                          <span className="font-semibold text-sm text-gray-800">{b.label}</span>
                          <span className="ml-auto text-xs text-gray-400">{b.txCount} tx</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gray-50 p-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase">Expenses</p>
                            <p className="text-base font-bold text-red-500 mt-0.5">{formatCurrency(b.expenses, baseCurrency)}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 p-3 text-center">
                            <p className="text-[10px] text-gray-400 uppercase">% of Income</p>
                            <p className="text-base font-bold text-indigo-600 mt-0.5">{pctOfIncome}%</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>% of all tagged expenses</span>
                            <span>{pctOfExpenses}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pctOfExpenses}%`, background: b.color }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Cash flow tab ─────────────────────────────────────────────────── */}
      {activeTab === 'cashflow' && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <SectionTitle>Cumulative Cash Flow</SectionTitle>
            {!hasData ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cashFlow} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 100).toFixed(0)}`} width={54} />
                  <Tooltip content={<CurrencyTooltip currency={baseCurrency} />} />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <SectionTitle>Monthly Inflow vs Outflow</SectionTitle>
            {!hasData ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cashFlow} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 100).toFixed(0)}`} width={54} />
                  <Tooltip content={<CurrencyTooltip currency={baseCurrency} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Monthly table */}
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Month</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Inflow</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Outflow</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {cashFlow.map((row, i) => (
                  <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2 font-medium text-gray-700">{row.month}</td>
                    <td className="px-3 py-2 text-right text-green-600">{formatCurrency(row.inflow, baseCurrency)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{formatCurrency(row.outflow, baseCurrency)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.cumulative >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
                      {formatCurrency(row.cumulative, baseCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

