import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle } from 'lucide-react'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getVisibleAccountIds, isTransactionForVisiblePrimaryAccount } from '@/lib/accounts'
import { convertToBase, formatCurrency } from '@/lib/currency'
import type { Transaction } from '@/types'

// ── Pure helpers ──────────────────────────────────────────────────────────────

function toBase(tx: Transaction): number {
  return tx.exchangeRate ? convertToBase(tx.amount, tx.exchangeRate) : tx.amount
}

interface MonthMetrics {
  label: string        // e.g. "Apr 26"
  income: number       // base-currency cents
  expenses: number     // base-currency cents
  net: number          // income - expenses
  rate: number         // savings rate 0–100 (can be negative)
}

function computeMonth(
  transactions: Transaction[],
  visibleAccountIds: Set<string>,
  monthDate: Date,
): MonthMetrics {
  const from = startOfMonth(monthDate).toISOString()
  const to   = endOfMonth(monthDate).toISOString()

  const relevant = transactions.filter(
    (tx) =>
      tx.date >= from &&
      tx.date <= to &&
      tx.status !== 'cancelled' &&
      isTransactionForVisiblePrimaryAccount(tx, visibleAccountIds),
  )

  const income   = relevant.filter((tx) => tx.type === 'income').reduce((s, tx) => s + toBase(tx), 0)
  const expenses = relevant.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + toBase(tx), 0)
  const net      = income - expenses
  const rate     = income > 0 ? Math.round((net / income) * 100) : 0

  return { label: format(monthDate, 'MMM yy'), income, expenses, net, rate }
}

function avgRate(months: MonthMetrics[]): number {
  const withIncome = months.filter((m) => m.income > 0)
  if (withIncome.length === 0) return 0
  return Math.round(withIncome.reduce((s, m) => s + m.rate, 0) / withIncome.length)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RateGauge({ rate }: { rate: number }) {
  const clamped = Math.max(-100, Math.min(100, rate))
  const fill    = Math.round(((clamped + 100) / 200) * 100)
  const color =
    rate >= 20 ? 'bg-emerald-500'
    : rate >= 5 ? 'bg-blue-500'
    : rate >= 0 ? 'bg-amber-400'
    : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>−100%</span>
        <span>0%</span>
        <span>+100%</span>
      </div>
    </div>
  )
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-indigo-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}

function MonthBar({ m, maxIncome, currency }: { m: MonthMetrics; maxIncome: number; currency: string }) {
  const incomeW   = maxIncome > 0 ? (m.income   / maxIncome) * 100 : 0
  const expensesW = maxIncome > 0 ? (m.expenses / maxIncome) * 100 : 0
  const rateColor =
    m.rate >= 20 ? 'text-emerald-600'
    : m.rate >= 5 ? 'text-blue-600'
    : m.rate >= 0 ? 'text-amber-500'
    : 'text-red-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium w-12 shrink-0">{m.label}</span>
        <div className="flex-1 mx-2 space-y-0.5">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${incomeW}%` }} />
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-red-400" style={{ width: `${expensesW}%` }} />
          </div>
        </div>
        <span className={`font-bold w-10 text-right shrink-0 ${rateColor}`}>{m.rate}%</span>
      </div>
      <p className="text-[10px] text-gray-400 pl-14">
        {formatCurrency(m.income, currency)} / {formatCurrency(m.expenses, currency)}
      </p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SavingCapacity() {
  const { t } = useTranslation()
  const { transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()

  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])

  const today = new Date()

  const months = useMemo((): MonthMetrics[] =>
    Array.from({ length: 6 }, (_, i) =>
      computeMonth(transactions, visibleAccountIds, subMonths(today, 5 - i)),
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [transactions, visibleAccountIds])

  const currentMonth = months[5]
  const last3Avg     = avgRate(months.slice(3))
  const last6Avg     = avgRate(months)

  const maxIncome = Math.max(...months.map((m) => m.income), 1)

  const rateLabel =
    currentMonth.rate >= 20 ? t('insights.rateExcellent')
    : currentMonth.rate >= 5 ? t('insights.rateGood')
    : currentMonth.rate >= 0 ? t('insights.rateLow')
    : t('insights.rateNegative')

  const RateIcon = currentMonth.rate >= 5 ? TrendingUp : currentMonth.rate < 0 ? TrendingDown : Minus
  const rateIconColor =
    currentMonth.rate >= 5 ? 'text-emerald-500' : currentMonth.rate < 0 ? 'text-red-500' : 'text-amber-400'

  const tips: string[] = [
    t('insights.tipBudget'),
    t('insights.tipReduceExpenses'),
    t('insights.tipAutomate'),
    t('insights.tipIncreaseIncome'),
  ]

  return (
    <>
      {/* ── Saving Capacity Card ─────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white px-4 pt-4 pb-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-800">{t('insights.savingCapacity')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('insights.savingCapacityDesc')}</p>
          </div>
          <div className={`flex items-center gap-1 shrink-0 ${rateIconColor}`}>
            <RateIcon size={20} strokeWidth={2.5} />
            <span className="text-lg font-bold">{currentMonth.rate}%</span>
          </div>
        </div>

        <RateGauge rate={currentMonth.rate} />

        <p className="text-xs text-gray-500 italic">{rateLabel}</p>

        {/* This month metrics */}
        <div className="rounded-xl bg-gray-50 px-3 py-2 space-y-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {t('insights.thisMonth')}
          </p>
          {currentMonth.income === 0 ? (
            <p className="text-xs text-gray-400 py-1">{t('insights.noIncome')}</p>
          ) : (
            <>
              <MetricRow label={t('insights.income')}      value={formatCurrency(currentMonth.income,   baseCurrency)} />
              <MetricRow label={t('insights.expenses')}    value={formatCurrency(currentMonth.expenses, baseCurrency)} />
              <MetricRow label={t('insights.net')}         value={formatCurrency(currentMonth.net,      baseCurrency)} highlight />
              <MetricRow label={t('insights.savingsRate')} value={`${currentMonth.rate}%`}               highlight />
            </>
          )}
        </div>

        {/* Averages */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('insights.last3Months'), value: `${last3Avg}%` },
            { label: t('insights.last6Months'), value: `${last6Avg}%` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
              <p className={`text-lg font-bold ${
                parseInt(value) >= 20 ? 'text-emerald-600'
                : parseInt(value) >= 5 ? 'text-blue-600'
                : parseInt(value) >= 0 ? 'text-amber-500'
                : 'text-red-500'
              }`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monthly Breakdown ────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white px-4 pt-4 pb-5 space-y-3">
        <h2 className="font-semibold text-gray-800">{t('insights.monthlyBreakdown')}</h2>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-emerald-400" />
            {t('insights.income')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-red-400" />
            {t('insights.expenses')}
          </span>
        </div>
        <div className="space-y-3">
          {months.map((m) => (
            <MonthBar key={m.label} m={m} maxIncome={maxIncome} currency={baseCurrency} />
          ))}
        </div>
      </div>

      {/* ── Tips ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white px-4 pt-4 pb-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-indigo-500 shrink-0" />
          <h2 className="font-semibold text-gray-800">{t('insights.tipTitle')}</h2>
        </div>
        <ul className="space-y-2.5">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              {currentMonth.rate < 5 && i < 2
                ? <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                : <span className="mt-0.5 h-3.5 w-3.5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="block h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  </span>
              }
              <span className="text-sm text-gray-600">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
