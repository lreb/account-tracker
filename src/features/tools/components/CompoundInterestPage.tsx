import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'

import { useSettingsStore } from '@/stores/settings.store'
import { formatCurrency } from '@/lib/currency'
import {
  calculateCompoundInterest,
  generateChartData,
  type CompoundInterestInputs,
} from '@/lib/compound-interest'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  principal:             z.coerce.number().min(0),
  annualRate:            z.coerce.number().min(0).max(100),
  time:                  z.coerce.number().min(0.1).max(500),
  timeUnit:              z.enum(['years', 'months']),
  compoundingFreq:       z.enum(['annual', 'semiannual', 'quarterly', 'monthly', 'daily', 'continuous']),
  contributionAmount:    z.coerce.number().min(0),
  contributionFreq:      z.enum(['monthly', 'annual']),
  contributionGrowthRate: z.coerce.number().min(0).max(100),
  withdrawalAmount:      z.coerce.number().min(0),
  withdrawalFreq:        z.enum(['monthly', 'annual']),
  inflationRate:         z.coerce.number().min(0).max(50),
})

type FormValues = z.infer<typeof schema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a plain float as currency (converts to cents internally). */
function fmt(amount: number, currency: string): string {
  return formatCurrency(Math.round(amount * 100), currency)
}

/** Format a plain float as compact axis label (K / M). */
function shortFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toFixed(0)
}

// ─── Sub-component: stat card ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlight ? 'bg-indigo-50 border-indigo-200' : 'bg-white'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">
        {label}
      </p>
      <p
        className={`text-lg font-bold truncate ${
          highlight ? 'text-indigo-700' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompoundInterestPage() {
  const { t } = useTranslation()
  const { baseCurrency } = useSettingsStore()
  const [showFormulas, setShowFormulas] = useState(false)

  const { register, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      principal:              10_000,
      annualRate:             7,
      time:                   10,
      timeUnit:               'years',
      compoundingFreq:        'monthly',
      contributionAmount:     200,
      contributionFreq:       'monthly',
      contributionGrowthRate: 0,
      withdrawalAmount:       0,
      withdrawalFreq:         'monthly',
      inflationRate:          3,
    },
    mode: 'onChange',
  })

  const values = watch()

  const inputs = useMemo<CompoundInterestInputs>(() => ({
    principal:              values.principal             ?? 0,
    annualRate:             values.annualRate            ?? 0,
    time:                   values.time                  ?? 1,
    timeUnit:               values.timeUnit,
    compoundingFreq:        values.compoundingFreq,
    contributionAmount:     values.contributionAmount    ?? 0,
    contributionFreq:       values.contributionFreq,
    contributionGrowthRate: values.contributionGrowthRate ?? 0,
    withdrawalAmount:       values.withdrawalAmount      ?? 0,
    withdrawalFreq:         values.withdrawalFreq,
    inflationRate:          values.inflationRate         ?? 0,
  }), [values])

  const results   = useMemo(() => calculateCompoundInterest(inputs), [inputs])
  const chartData = useMemo(() => generateChartData(inputs), [inputs])

  // ── CSV export ───────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const headers = [
      t('compoundInterest.year'),
      t('compoundInterest.openingBalance'),
      t('compoundInterest.interest'),
      t('compoundInterest.contributions'),
      t('compoundInterest.withdrawals'),
      t('compoundInterest.closingBalance'),
      t('compoundInterest.realValueCol'),
    ]
    const rows = results.breakdown.map((row) => [
      row.period,
      row.openingBalance.toFixed(2),
      row.interest.toFixed(2),
      row.contributions.toFixed(2),
      row.withdrawals.toFixed(2),
      row.closingBalance.toFixed(2),
      row.realValue.toFixed(2),
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'compound-interest.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Currency formatter for tooltip ───────────────────────────────────────
  const tooltipFormatter = (value: number) => fmt(value, baseCurrency)

  // ── Interest earned per year for stacked area chart ───────────────────────
  const stackedChartData = useMemo(
    () =>
      chartData.map((pt) => ({
        ...pt,
        interestGain: Math.max(0, pt.totalValue - pt.investedCapital),
      })),
    [chartData],
  )

  const fieldCls = (hasError: boolean) =>
    `h-9 rounded-xl border px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
      hasError ? 'border-red-400' : 'border-gray-300'
    }`

  const selectCls =
    'h-9 rounded-xl border border-gray-300 px-3 text-sm text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none'

  return (
    <div className="p-4 pb-24 space-y-5 max-w-2xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {t('compoundInterest.title')}
        </h1>
        <p className="text-sm text-gray-500">{t('compoundInterest.subtitle')}</p>
      </div>

      {/* ── Parameters form ────────────────────────────────────────────────── */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
          {t('compoundInterest.parameters')}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {/* Principal */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs text-gray-600">{t('compoundInterest.principal')}</Label>
            <input
              {...register('principal')}
              type="number"
              min="0"
              step="100"
              className={fieldCls(!!errors.principal)}
            />
          </div>

          {/* Annual Rate */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs text-gray-600">{t('compoundInterest.annualRate')}</Label>
            <input
              {...register('annualRate')}
              type="number"
              min="0"
              max="100"
              step="0.1"
              className={fieldCls(!!errors.annualRate)}
            />
          </div>

          {/* Time + unit */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs text-gray-600">{t('compoundInterest.timePeriod')}</Label>
            <div className="flex gap-2 items-center">
              <input
                {...register('time')}
                type="number"
                min="0.1"
                step="1"
                className={`${fieldCls(!!errors.time)} w-20 min-w-0 shrink-0`}
              />
              <select {...register('timeUnit')} className={`${selectCls} flex-1 min-w-0`}>
                <option value="years">{t('compoundInterest.years')}</option>
                <option value="months">{t('compoundInterest.months')}</option>
              </select>
            </div>
          </div>

          {/* Compounding frequency */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs text-gray-600">{t('compoundInterest.compoundingFrequency')}</Label>
            <select {...register('compoundingFreq')} className={selectCls}>
              <option value="annual">{t('compoundInterest.annual')}</option>
              <option value="semiannual">{t('compoundInterest.semiannual')}</option>
              <option value="quarterly">{t('compoundInterest.quarterly')}</option>
              <option value="monthly">{t('compoundInterest.monthly')}</option>
              <option value="daily">{t('compoundInterest.daily')}</option>
              <option value="continuous">{t('compoundInterest.continuous')}</option>
            </select>
          </div>

          {/* Inflation rate */}
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs text-gray-600">{t('compoundInterest.inflationRate')}</Label>
            <input
              {...register('inflationRate')}
              type="number"
              min="0"
              max="50"
              step="0.1"
              className={fieldCls(!!errors.inflationRate)}
            />
          </div>
        </div>

        {/* ── Contributions & Withdrawals ──────────────────────────────────── */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            {t('compoundInterest.contributionsSection')}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Contribution amount */}
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs text-gray-600">{t('compoundInterest.contributionAmount')}</Label>
              <div className="flex gap-2 items-center">
                <input
                  {...register('contributionAmount')}
                  type="number"
                  min="0"
                  step="50"
                  className={`${fieldCls(!!errors.contributionAmount)} w-24 min-w-0 shrink-0`}
                />
                <select
                  {...register('contributionFreq')}
                  className={`${selectCls} flex-1 min-w-0`}
                >
                  <option value="monthly">{t('compoundInterest.monthlyFreq')}</option>
                  <option value="annual">{t('compoundInterest.annualFreq')}</option>
                </select>
              </div>
            </div>

            {/* Contribution growth */}
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs text-gray-600">
                {t('compoundInterest.contributionGrowth')}
              </Label>
              <input
                {...register('contributionGrowthRate')}
                type="number"
                min="0"
                max="100"
                step="0.5"
                className={fieldCls(!!errors.contributionGrowthRate)}
              />
            </div>

            {/* Withdrawal amount */}
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs text-gray-600">{t('compoundInterest.withdrawalAmount')}</Label>
              <div className="flex gap-2 items-center">
                <input
                  {...register('withdrawalAmount')}
                  type="number"
                  min="0"
                  step="50"
                  className={`${fieldCls(!!errors.withdrawalAmount)} w-24 min-w-0 shrink-0`}
                />
                <select
                  {...register('withdrawalFreq')}
                  className={`${selectCls} flex-1 min-w-0`}
                >
                  <option value="monthly">{t('compoundInterest.monthlyFreq')}</option>
                  <option value="annual">{t('compoundInterest.annualFreq')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
          {t('compoundInterest.results')}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <StatCard
              label={t('compoundInterest.futureValue')}
              value={fmt(results.futureValue, baseCurrency)}
              highlight
            />
          </div>
          <StatCard
            label={t('compoundInterest.totalInvested')}
            value={fmt(inputs.principal + results.totalContributions, baseCurrency)}
          />
          <StatCard
            label={t('compoundInterest.interestEarned')}
            value={fmt(results.totalInterest, baseCurrency)}
          />
          <StatCard
            label={t('compoundInterest.effectiveRate')}
            value={`${(results.effectiveAnnualRate * 100).toFixed(3)}%`}
          />
          <StatCard
            label={t('compoundInterest.doubleTime')}
            value={
              results.doubleTime != null
                ? t('compoundInterest.doubleTimeValue', {
                    years: results.doubleTime.toFixed(1),
                  })
                : t('compoundInterest.notApplicable')
            }
          />
          {results.totalWithdrawals > 0 && (
            <StatCard
              label={t('compoundInterest.totalWithdrawals')}
              value={fmt(results.totalWithdrawals, baseCurrency)}
            />
          )}
          {inputs.inflationRate > 0 && (
            <StatCard
              label={t('compoundInterest.realValue')}
              value={fmt(results.realValue, baseCurrency)}
            />
          )}
        </div>
      </div>

      {/* ── Growth chart ───────────────────────────────────────────────────── */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
          {t('compoundInterest.growthChart')}
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={stackedChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradInterest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                `${v}${values.timeUnit === 'years' ? 'y' : 'm'}`
              }
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={shortFmt}
              width={52}
            />
            <Tooltip
              formatter={(val, name) => [
                tooltipFormatter(Number(val)),
                name,
              ]}
              labelFormatter={(label) =>
                `${t('compoundInterest.year')} ${label}`
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="investedCapital"
              stackId="a"
              stroke="#10b981"
              fill="url(#gradInvested)"
              name={t('compoundInterest.investedCapital')}
            />
            <Area
              type="monotone"
              dataKey="interestGain"
              stackId="a"
              stroke="#6366f1"
              fill="url(#gradInterest)"
              name={t('compoundInterest.interestAccumulated')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Comparison chart: simple vs compound ───────────────────────────── */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            {t('compoundInterest.comparisonChart')}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('compoundInterest.principalOnly')}</p>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                `${v}${values.timeUnit === 'years' ? 'y' : 'm'}`
              }
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={shortFmt}
              width={52}
            />
            <Tooltip
              formatter={(val, name) => [
                tooltipFormatter(Number(val)),
                name,
              ]}
              labelFormatter={(label) =>
                `${t('compoundInterest.year')} ${label}`
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="compoundOnly"
              stroke="#6366f1"
              dot={false}
              strokeWidth={2}
              name={t('compoundInterest.compoundLine')}
            />
            <Line
              type="monotone"
              dataKey="simpleOnly"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={2}
              strokeDasharray="5 5"
              name={t('compoundInterest.simpleLine')}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-2xl bg-indigo-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-400 mb-1">
              {t('compoundInterest.compoundLine')}
            </p>
            <p className="text-base font-bold text-indigo-700">
              {fmt(chartData[chartData.length - 1]?.compoundOnly ?? inputs.principal, baseCurrency)}
            </p>
            <p className="text-xs text-indigo-500">
              {fmt(
                (chartData[chartData.length - 1]?.compoundOnly ?? inputs.principal) - inputs.principal,
                baseCurrency,
              )}{' '}
              {t('compoundInterest.interestEarned').toLowerCase()}
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500 mb-1">
              {t('compoundInterest.simpleLine')}
            </p>
            <p className="text-base font-bold text-amber-700">
              {fmt(results.simpleInterestFV, baseCurrency)}
            </p>
            <p className="text-xs text-amber-600">
              {fmt(
                results.simpleInterestFV - inputs.principal,
                baseCurrency,
              )}{' '}
              {t('compoundInterest.interestEarned').toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Formulas ───────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFormulas((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
            {showFormulas
              ? t('compoundInterest.hideFormulas')
              : t('compoundInterest.showFormulas')}
          </span>
          {showFormulas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showFormulas && (
          <div className="px-4 pb-5 space-y-4 border-t">
            {[
              {
                title: t('compoundInterest.formulaStandard'),
                formula: 'A = P × (1 + r/n)^(n×t)',
                desc: 'P = principal, r = annual rate, n = compounding periods/year, t = years',
              },
              {
                title: t('compoundInterest.formulaContinuous'),
                formula: 'A = P × eʳᵗ',
                desc: 'e = Euler\'s number ≈ 2.71828',
              },
              {
                title: t('compoundInterest.formulaWithPMT'),
                formula: 'A = P×(1+r/n)^(nt) + PMT×[(1+r/n)^(nt) − 1] / (r/n)',
                desc: 'PMT = periodic contribution (ordinary annuity, end-of-period)',
              },
              {
                title: t('compoundInterest.formulaTEA'),
                formula: 'TEA = (1 + r/n)ⁿ − 1',
                desc: `Current TEA: ${(results.effectiveAnnualRate * 100).toFixed(4)}%`,
              },
              {
                title: t('compoundInterest.formulaReal'),
                formula: 'A_real = A / (1 + i)ᵗ',
                desc: 'i = annual inflation rate',
              },
              {
                title: t('compoundInterest.formulaRule72'),
                formula: 't ≈ 72 / r_percent',
                desc:
                  results.doubleTime != null
                    ? `At ${values.annualRate}%/yr → ${results.doubleTime.toFixed(1)} years`
                    : 'Rate must be > 0',
              },
            ].map(({ title, formula, desc }) => (
              <div key={title} className="pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">{title}</p>
                <code className="block bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-indigo-700">
                  {formula}
                </code>
                <p className="text-[11px] text-gray-400 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Year-by-year breakdown ──────────────────────────────────────────── */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            {t('compoundInterest.breakdown')}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs h-7 px-3 rounded-full"
          >
            <Download size={12} />
            {t('compoundInterest.exportCsv')}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="border-b bg-gray-50">
                {[
                  t('compoundInterest.year'),
                  t('compoundInterest.openingBalance'),
                  t('compoundInterest.interest'),
                  t('compoundInterest.contributions'),
                  t('compoundInterest.withdrawals'),
                  t('compoundInterest.closingBalance'),
                  ...(inputs.inflationRate > 0 ? [t('compoundInterest.realValueCol')] : []),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 first:text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.breakdown.map((row) => (
                <tr key={row.period} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-gray-700">{row.period}</td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {fmt(row.openingBalance, baseCurrency)}
                  </td>
                  <td className="px-3 py-2 text-right text-indigo-600 font-medium">
                    {fmt(row.interest, baseCurrency)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-600">
                    {row.contributions > 0 ? fmt(row.contributions, baseCurrency) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-red-500">
                    {row.withdrawals > 0 ? fmt(row.withdrawals, baseCurrency) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                    {fmt(row.closingBalance, baseCurrency)}
                  </td>
                  {inputs.inflationRate > 0 && (
                    <td className="px-3 py-2 text-right text-amber-600">
                      {fmt(row.realValue, baseCurrency)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ScrollToTopButton />
    </div>
  )
}
