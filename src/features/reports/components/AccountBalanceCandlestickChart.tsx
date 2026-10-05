import { useMemo } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/currency'
import type { Account, Transaction } from '@/types'
import { buildCombinedAccountCandles, type AccountPerformanceInterval } from '../lib/account-performance'

interface AccountBalanceCandlestickChartProps {
  accounts: Account[]
  transactions: Transaction[]
  interval: AccountPerformanceInterval
  baseCurrency: string
  getRateForPair: (from: string, to: string) => number | null
}

const CHART_WIDTH = 720
const CHART_HEIGHT = 230
const CHART_PADDING = { top: 12, right: 12, bottom: 28, left: 82 }

export function AccountBalanceCandlestickChart({ accounts, transactions, interval, baseCurrency, getRateForPair }: AccountBalanceCandlestickChartProps) {
  const { t } = useTranslation()
  const candles = useMemo(
    () => buildCombinedAccountCandles(accounts, transactions, interval, baseCurrency, getRateForPair),
    [accounts, transactions, interval, baseCurrency, getRateForPair],
  )
  const chartArea = {
    width: CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right,
    height: CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom,
  }
  const minimum = Math.min(...candles.map((candle) => candle.low))
  const maximum = Math.max(...candles.map((candle) => candle.high))
  const valueRange = maximum - minimum || Math.abs(maximum) * 0.05 || 1
  const y = (value: number) => CHART_PADDING.top + ((maximum + valueRange * 0.05 - value) / (valueRange * 1.1)) * chartArea.height
  const xStep = candles.length > 1 ? chartArea.width / candles.length : chartArea.width
  const candleWidth = Math.max(2, Math.min(12, xStep * 0.58))
  const datePattern = interval === '1h' || interval === '6h' || interval === '12h' || interval === '1d' ? 'MMM d HH:mm'
    : interval === '1w' || interval === '2w' || interval === '1m' ? 'MMM d' : 'MMM yyyy'

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-700">{t('reports.combinedBalanceCandlestick')}</h2>
      <p className="mb-3 text-xs text-gray-500">{t('reports.candlestickDescription', { count: accounts.length, currency: baseCurrency })}</p>
      {candles.length === 0 ? (
        <p className="flex h-48 items-center justify-center text-sm text-gray-400">
          {accounts.length === 0 ? t('reports.selectAccountsForPerformance') : t('reports.missingPerformanceRates')}
        </p>
      ) : (
        <svg role="img" aria-label={t('reports.combinedBalanceCandlestick')} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="h-56 w-full overflow-visible">
          {[0, 1, 2, 3, 4].map((index) => {
            const value = maximum + valueRange * 0.05 - (index / 4) * valueRange * 1.1
            const position = y(value)
            return (
              <g key={index}>
                <line x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={position} y2={position} stroke="#e5e7eb" strokeDasharray="3 3" />
                <text x={CHART_PADDING.left - 8} y={position + 3} textAnchor="end" fontSize="9" fill="#6b7280">{formatCurrency(value, baseCurrency)}</text>
              </g>
            )
          })}
          {candles.map((candle, index) => {
            const centerX = CHART_PADDING.left + xStep * (index + 0.5)
            const openY = y(candle.open)
            const closeY = y(candle.close)
            const bodyTop = Math.min(openY, closeY)
            const bodyHeight = Math.max(2, Math.abs(closeY - openY))
            const color = candle.close >= candle.open ? '#10b981' : '#ef4444'
            const date = new Date(candle.timestamp)
            const details = `${format(date, 'PPpp')} · ${t('reports.opening')}: ${formatCurrency(candle.open, baseCurrency)} · ${t('reports.high')}: ${formatCurrency(candle.high, baseCurrency)} · ${t('reports.low')}: ${formatCurrency(candle.low, baseCurrency)} · ${t('reports.closing')}: ${formatCurrency(candle.close, baseCurrency)}`
            return (
              <g key={candle.timestamp} tabIndex={0} role="img" aria-label={details}>
                <title>{details}</title>
                <line x1={centerX} x2={centerX} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={1.5} />
                <rect x={centerX - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx={1} />
              </g>
            )
          })}
          {[0, Math.floor((candles.length - 1) / 2), candles.length - 1].map((index) => {
            const candle = candles[index]
            if (!candle) return null
            const date = new Date(candle.timestamp)
            return <text key={index} x={CHART_PADDING.left + xStep * (index + 0.5)} y={CHART_HEIGHT - 7} textAnchor="middle" fontSize="9" fill="#6b7280">{format(date, datePattern)}</text>
          })}
        </svg>
      )}
    </section>
  )
}
