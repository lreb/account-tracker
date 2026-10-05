import { useMemo } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid, Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/currency'
import type { Account, Transaction } from '@/types'
import {
  ACCOUNT_PERFORMANCE_INTERVALS, ACCOUNT_PERFORMANCE_INTERVAL_KEYS,
  buildAccountPerformanceData, type AccountPerformanceInterval,
} from '../lib/account-performance'
import { PRESET_COLORS } from '@/constants/label-colors'

const ACCOUNT_CHART_COLORS = PRESET_COLORS;

interface AccountPerformanceChartProps {
  accounts: Account[]
  transactions: Transaction[]
  interval: AccountPerformanceInterval
  onIntervalChange: (interval: AccountPerformanceInterval) => void
  baseCurrency: string
  getRateForPair: (from: string, to: string) => number | null
}

export function AccountPerformanceChart({ accounts, transactions, interval, onIntervalChange, baseCurrency, getRateForPair }: AccountPerformanceChartProps) {
  const { t } = useTranslation()
  const data = useMemo(
    () => buildAccountPerformanceData(accounts, transactions, interval, baseCurrency, getRateForPair),
    [accounts, transactions, interval, baseCurrency, getRateForPair],
  )
  const hasRateGap = data.some((point) => accounts.some((account) => point[account.id] === null))

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('reports.accountPerformance')}</h2>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <span>{t('reports.interval')}</span>
          <select
            aria-label={t('reports.interval')}
            value={interval}
            onChange={(event) => onIntervalChange(event.target.value as AccountPerformanceInterval)}
            className="rounded-lg border bg-white px-2 py-1.5 text-sm"
          >
            {ACCOUNT_PERFORMANCE_INTERVALS.map((option) => (
              <option key={option} value={option}>{t(`reports.performanceIntervals.${ACCOUNT_PERFORMANCE_INTERVAL_KEYS[option]}`)}</option>
            ))}
          </select>
        </label>
      </div>
      {accounts.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-sm text-gray-400">{t('reports.selectAccountsForPerformance')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={{ fontSize: 10 }} tickFormatter={(value: number) => format(new Date(value), interval === '1d' ? 'p' : interval === '1w' || interval === '2w' || interval === '1m' ? 'MMM d' : 'MMM yyyy')} minTickGap={24} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => (value / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} width={68} />
            <Tooltip labelFormatter={(value) => new Date(Number(value)).toLocaleString()} formatter={(value, name) => [formatCurrency(Number(value), baseCurrency), name]} />
            {accounts.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {accounts.map((account, index) => (
              <Line key={account.id} type="monotone" dataKey={account.id} name={account.name} stroke={ACCOUNT_CHART_COLORS[index % ACCOUNT_CHART_COLORS.length]} strokeWidth={2} dot={data.length < 32 ? { r: 2 } : false} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-1 text-right text-[10px] text-gray-400">{t('reports.valuesInCurrency', { currency: baseCurrency })}</p>
      {hasRateGap && <p className="mt-2 text-xs text-amber-600">{t('reports.missingPerformanceRates')}</p>}
    </section>
  )
}
