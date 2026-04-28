import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/currency'

export type TrendPeriod = '3m' | '6m' | '1y' | '2y'

interface TrendDataPoint {
  month: string
  income: number
  expenses: number
}

interface DashboardTrendChartProps {
  trend: TrendDataPoint[]
  trendPeriod: TrendPeriod
  baseCurrency: string
  onPeriodChange: (period: TrendPeriod) => void
}

export function DashboardTrendChart({
  trend,
  trendPeriod,
  baseCurrency,
  onPeriodChange,
}: DashboardTrendChartProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {t('dashboard.trendTitle')}
        </p>
        <div className="flex gap-1">
          {(['3m', '6m', '1y', '2y'] as TrendPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                trendPeriod === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t(`dashboard.trendPeriod.${p}`)}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={trend} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
          <YAxis
            width={52}
            tick={{ fontSize: 9 }}
            tickFormatter={(v: number) => {
              const units = v / 100
              if (Math.abs(units) >= 1_000_000) return `${(units / 1_000_000).toFixed(1)}M`
              if (Math.abs(units) >= 1_000) return `${(units / 1_000).toFixed(0)}K`
              return String(units)
            }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (typeof value !== 'number') return ['', name]
              return [formatCurrency(value, baseCurrency), name]
            }}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Bar dataKey="income" fill="#10b981" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
