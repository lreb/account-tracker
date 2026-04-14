import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachMonthOfInterval, subMonths,
} from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Info, ChevronRight } from 'lucide-react'

import { formatCurrency } from '@/lib/currency'
import { calcKmSinceLastFill, getServiceTypeLabel } from '@/lib/vehicles'
import type { FuelLog, VehicleService } from '@/types'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

type DrillKey = 'fuel-cost' | 'service-cost' | 'fill-ups' | 'km-per-fill'
type DrillRange = '3m' | '6m' | '1y' | '2y' | 'all'

const DRILL_RANGES: { value: DrillRange; label: string }[] = [
  { value: '3m',  label: '3M' },
  { value: '6m',  label: '6M' },
  { value: '1y',  label: '1Y' },
  { value: '2y',  label: '2Y' },
  { value: 'all', label: 'All' },
]

interface DrillPoint { label: string; value: number }

export function VehicleStats({
  logs,
  services,
  baseCurrency,
  initialOdometer,
  overrideTotalDistance,
  overrideAvgKmPerL,
}: {
  logs: FuelLog[]
  services: VehicleService[]
  baseCurrency: string
  initialOdometer: number
  /** Fleet mode: pre-computed sum of per-vehicle distances (km). Overrides internal calculation. */
  overrideTotalDistance?: number
  /** Fleet mode: pre-computed weighted-average km/L across all vehicles. Overrides internal calculation. */
  overrideAvgKmPerL?: number
}) {
  const { t } = useTranslation()
  const [drill, setDrill]           = useState<DrillKey | null>(null)
  const [drillRange, setDrillRange] = useState<DrillRange>('1y')

  // ── Current month stats ─────────────────────────────────────────────────
  const currentMonthStats = useMemo(() => {
    const now = new Date()
    const ms  = startOfMonth(now)
    const me  = endOfMonth(now)
    const ml  = logs.filter((l) => { const d = parseISO(l.date); return d >= ms && d <= me })
    const msv = services.filter((s) => { const d = parseISO(s.date); return d >= ms && d <= me })
    return {
      fuelCost:    ml.reduce((s, l) => s + l.totalCost, 0),
      serviceCost: msv.reduce((s, sv) => s + sv.cost, 0),
      fillUps:     ml.length,
      liters:      ml.reduce((s, l) => s + l.liters, 0),
    }
  }, [logs, services])

  // ── Summary stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalFuelCost    = logs.reduce((s, l) => s + l.totalCost, 0)
    const totalServiceCost = services.reduce((s, sv) => s + sv.cost, 0)
    const totalLiters      = logs.reduce((s, l) => s + l.liters, 0)
    const fillUpCount      = logs.length
    const sortedLogs       = [...logs].sort((a, b) => a.date.localeCompare(b.date))
    let totalKm = 0, totalLitersForEff = 0
    const kmPairs: number[] = []
    for (let i = 1; i < sortedLogs.length; i++) {
      const km = calcKmSinceLastFill(sortedLogs[i].odometer, sortedLogs[i - 1].odometer)
      if (km > 0) { totalKm += km; totalLitersForEff += sortedLogs[i].liters; kmPairs.push(km) }
    }
    const avgKmPerL    = totalLitersForEff > 0 ? totalKm / totalLitersForEff : 0
    const avgKmPerFill = kmPairs.length > 0 ? Math.round(kmPairs.reduce((s, k) => s + k, 0) / kmPairs.length) : 0
    const safeInitialOdo = Number(initialOdometer) || 0
    const odometerValues = sortedLogs.map((l) => Number(l.odometer))
    const maxOdo = odometerValues.length > 0 ? Math.max(...odometerValues) : 0
    const minOdo = odometerValues.length > 0
      ? (safeInitialOdo > 0 ? safeInitialOdo : Math.min(...odometerValues))
      : safeInitialOdo
    const totalDistance = Math.max(0, maxOdo - minOdo)
    return { totalFuelCost, totalServiceCost, totalLiters, fillUpCount, avgKmPerL, avgKmPerFill, totalDistance, hasInitialOdo: safeInitialOdo > 0 }
  }, [logs, services, initialOdometer])

  // ── Monthly fuel data ───────────────────────────────────────────────────
  const monthlyFuelData = useMemo(() => {
    const now = new Date()
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 11), end: startOfMonth(now) })
    return months.map((ms) => {
      const me = endOfMonth(ms)
      const ml = logs.filter((l) => { const d = parseISO(l.date); return d >= ms && d <= me })
      return {
        month:   format(ms, 'MMM yy'),
        cost:    ml.reduce((s, l) => s + l.totalCost, 0) / 100,
        liters:  Math.round(ml.reduce((s, l) => s + l.liters, 0) * 100) / 100,
        fillUps: ml.length,
      }
    })
  }, [logs])

  // ── Monthly service data ────────────────────────────────────────────────
  const monthlyServiceData = useMemo(() => {
    const now = new Date()
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 11), end: startOfMonth(now) })
    return months.map((ms) => {
      const me   = endOfMonth(ms)
      const msv  = services.filter((s) => { const d = parseISO(s.date); return d >= ms && d <= me })
      return { month: format(ms, 'MMM yy'), cost: msv.reduce((s, sv) => s + sv.cost, 0) / 100, count: msv.length }
    })
  }, [services])

  // ── km between fills by month ───────────────────────────────────────────
  const kmBetweenFillsData = useMemo(() => {
    const sortedLogs   = [...logs].sort((a, b) => a.date.localeCompare(b.date))
    const pairsByMonth = new Map<string, number[]>()
    for (let i = 1; i < sortedLogs.length; i++) {
      const km = calcKmSinceLastFill(sortedLogs[i].odometer, sortedLogs[i - 1].odometer)
      if (km > 0) {
        const key = format(parseISO(sortedLogs[i].date), 'MMM yy')
        const arr = pairsByMonth.get(key) ?? []
        arr.push(km)
        pairsByMonth.set(key, arr)
      }
    }
    const now = new Date()
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 11), end: startOfMonth(now) })
    return months.map((ms) => {
      const key = format(ms, 'MMM yy')
      const kms = pairsByMonth.get(key) ?? []
      return { month: key, avgKm: kms.length > 0 ? Math.round(kms.reduce((s, k) => s + k, 0) / kms.length) : 0 }
    })
  }, [logs])

  // ── Service cost by type (pie) ──────────────────────────────────────────
  const serviceCostByType = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of services) map.set(s.serviceType, (map.get(s.serviceType) ?? 0) + s.cost)
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: getServiceTypeLabel(name, t), value: value / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [services, t])

  // ── Drill-down data ─────────────────────────────────────────────────────
  const drillData = useMemo((): DrillPoint[] => {
    if (!drill) return []

    // Helper: compute km-per-fill pairs grouped by key (month label or year string)
    function kmPerFillByKey(keyFn: (date: Date) => string): DrillPoint[] {
      const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date))
      const byKey = new Map<string, number[]>()
      for (let i = 1; i < sortedLogs.length; i++) {
        const km = calcKmSinceLastFill(sortedLogs[i].odometer, sortedLogs[i - 1].odometer)
        if (km > 0) {
          const key = keyFn(parseISO(sortedLogs[i].date))
          const arr = byKey.get(key) ?? []
          arr.push(km)
          byKey.set(key, arr)
        }
      }
      return Array.from(byKey.entries()).map(([label, kms]) => ({
        label,
        value: Math.round(kms.reduce((s, k) => s + k, 0) / kms.length),
      }))
    }

    // 'all' → yearly aggregation
    if (drillRange === 'all') {
      if (drill === 'km-per-fill') {
        return kmPerFillByKey((d) => String(d.getFullYear())).sort((a, b) => a.label.localeCompare(b.label))
      }
      const yearMap = new Map<number, number>()
      const src = drill === 'service-cost' ? services : logs
      for (const item of src) {
        const year = parseISO((item as { date: string }).date).getFullYear()
        const val  =
          drill === 'fuel-cost'    ? (item as FuelLog).totalCost / 100
          : drill === 'service-cost' ? (item as VehicleService).cost / 100
          : 1
        yearMap.set(year, (yearMap.get(year) ?? 0) + val)
      }
      return Array.from(yearMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([year, value]) => ({ label: String(year), value: Math.round(value * 100) / 100 }))
    }

    // monthly for 3m / 6m / 1y / 2y
    const nMonths  = drillRange === '3m' ? 3 : drillRange === '6m' ? 6 : drillRange === '1y' ? 12 : 24
    const now      = new Date()
    const monthList = eachMonthOfInterval({ start: subMonths(startOfMonth(now), nMonths - 1), end: startOfMonth(now) })

    if (drill === 'km-per-fill') {
      const pairs = kmPerFillByKey((d) => format(d, 'MMM yy'))
      return monthList.map((ms) => {
        const key   = format(ms, 'MMM yy')
        const found = pairs.find((p) => p.label === key)
        return { label: key, value: found?.value ?? 0 }
      })
    }

    return monthList.map((ms) => {
      const me    = endOfMonth(ms)
      const label = format(ms, 'MMM yy')
      if (drill === 'fuel-cost') {
        const ml = logs.filter((l) => { const d = parseISO(l.date); return d >= ms && d <= me })
        return { label, value: Math.round(ml.reduce((s, l) => s + l.totalCost, 0)) / 100 }
      }
      if (drill === 'service-cost') {
        const msv = services.filter((s) => { const d = parseISO(s.date); return d >= ms && d <= me })
        return { label, value: Math.round(msv.reduce((s, sv) => s + sv.cost, 0)) / 100 }
      }
      // fill-ups
      const ml = logs.filter((l) => { const d = parseISO(l.date); return d >= ms && d <= me })
      return { label, value: ml.length }
    })
  }, [drill, drillRange, logs, services])

  const drillTotal  = drillData.reduce((s, d) => s + d.value, 0)
  const drillActive = drillData.filter((d) => d.value > 0).length
  const drillAvg    = drillActive > 0 ? drillTotal / drillActive : 0

  // Drill meta: titles, color, format
  const drillMeta = useMemo(() => ({
    'fuel-cost':   { monthTitle: t('vehicles.stats.fuelCostByMonth'),       yearTitle: t('vehicles.stats.fuelCostByYear'),       color: '#6366f1', isCurrency: true,  unit: undefined },
    'service-cost':{ monthTitle: t('vehicles.stats.serviceCostByMonth'),    yearTitle: t('vehicles.stats.serviceCostByYear'),    color: '#f59e0b', isCurrency: true,  unit: undefined },
    'fill-ups':    { monthTitle: t('vehicles.stats.fillUpsByMonth'),        yearTitle: t('vehicles.stats.fillUpsByMonth'),       color: '#10b981', isCurrency: false, unit: undefined },
    'km-per-fill': { monthTitle: t('vehicles.stats.kmBetweenFillsByMonth'), yearTitle: t('vehicles.stats.kmBetweenFillsByMonth'), color: '#06b6d4', isCurrency: false, unit: 'km' },
  }), [t])

  // Fleet mode overrides
  const displayAvgKmPerL    = overrideAvgKmPerL     ?? stats.avgKmPerL
  const displayTotalDistance = overrideTotalDistance ?? stats.totalDistance

  const distanceTooltip =
    displayTotalDistance > 0      ? undefined
    : logs.length === 0           ? t('vehicles.stats.distanceNoLogs')
    : logs.length === 1           ? t('vehicles.stats.distanceOneFillUp')
    : !stats.hasInitialOdo        ? t('vehicles.stats.distanceNoInitialOdo')
    : t('vehicles.stats.distanceOdometerFlat')

  // Summary card definitions
  type CardDef = { label: string; value: string; thisMonth?: string; tooltip?: string; drillKey: DrillKey | null }
  const summaryCards: CardDef[] = [
    {
      label:     t('vehicles.stats.totalFuelCost'),
      value:     formatCurrency(stats.totalFuelCost, baseCurrency),
      thisMonth: currentMonthStats.fuelCost > 0 ? formatCurrency(currentMonthStats.fuelCost, baseCurrency) : undefined,
      drillKey:  'fuel-cost',
    },
    {
      label:     t('vehicles.stats.totalServiceCost'),
      value:     formatCurrency(stats.totalServiceCost, baseCurrency),
      thisMonth: currentMonthStats.serviceCost > 0 ? formatCurrency(currentMonthStats.serviceCost, baseCurrency) : undefined,
      drillKey:  'service-cost',
    },
    {
      label:    t('vehicles.stats.totalCost'),
      value:    formatCurrency(stats.totalFuelCost + stats.totalServiceCost, baseCurrency),
      drillKey: null,
    },
    {
      label:    t('vehicles.stats.avgKmPerL'),
      value:    displayAvgKmPerL > 0 ? `${displayAvgKmPerL.toFixed(1)} km/L` : '—',
      drillKey: null,
    },
    {
      label:     t('vehicles.stats.kmBetweenFills'),
      value:     stats.avgKmPerFill > 0 ? `${stats.avgKmPerFill} km` : '—',
      drillKey:  'km-per-fill',
    },
    {
      label:    t('vehicles.stats.totalDistance'),
      value:    displayTotalDistance > 0 ? `${displayTotalDistance.toLocaleString()} km` : '—',
      tooltip:  distanceTooltip,
      drillKey: null,
    },
    {
      label:     t('vehicles.stats.fillUps'),
      value:     stats.fillUpCount.toString(),
      thisMonth: currentMonthStats.fillUps > 0 ? String(currentMonthStats.fillUps) : undefined,
      drillKey:  'fill-ups',
    },
    {
      label:     t('vehicles.stats.totalLiters'),
      value:     `${stats.totalLiters.toFixed(1)} L`,
      thisMonth: currentMonthStats.liters > 0 ? `${currentMonthStats.liters.toFixed(1)} L` : undefined,
      drillKey:  null,
    },
    {
      label:    t('vehicles.stats.serviceCount'),
      value:    services.length.toString(),
      drillKey: null,
    },
  ]

  const activeDrill = drill ? drillMeta[drill] : null
  const drillTitle  = activeDrill
    ? (drillRange === 'all' ? activeDrill.yearTitle : activeDrill.monthTitle)
    : ''

  return (
    <div className="space-y-6">

      {/* ── Summary cards ───────────────────────────────────────────── */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2">
          {summaryCards.map(({ label, value, thisMonth, tooltip, drillKey }) => (
            <UITooltip key={label}>
              <TooltipTrigger asChild>
                <div
                  className={`rounded-xl border bg-white px-3 py-2 ${
                    drillKey
                      ? 'cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 active:scale-95 transition-all'
                      : ''
                  }`}
                  onClick={drillKey ? () => setDrill(drillKey) : undefined}
                >
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
                    {label}
                    {tooltip && <Info size={10} className="text-gray-300" />}
                  </p>
                  <p className="text-sm font-bold mt-0.5 flex items-center justify-between gap-1">
                    <span>{value}</span>
                    {drillKey && <ChevronRight size={12} className="text-gray-300 shrink-0" />}
                  </p>
                  {thisMonth && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      <span className="text-indigo-500 font-medium">{thisMonth}</span>{' '}
                      {t('vehicles.stats.thisMonth')}
                    </p>
                  )}
                </div>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </UITooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* ── Fuel cost by month ──────────────────────────────────────── */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('vehicles.stats.fuelCostByMonth')}</h3>
          <div className="rounded-xl border bg-white p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyFuelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip formatter={(val) => formatCurrency(Math.round(Number(val) * 100), baseCurrency)} />
                <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Fill-ups per month ──────────────────────────────────────── */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('vehicles.stats.fillUpsByMonth')}</h3>
          <div className="rounded-xl border bg-white p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyFuelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="fillUps" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── km between fills ────────────────────────────────────────── */}
      {kmBetweenFillsData.some((d) => d.avgKm > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('vehicles.stats.kmBetweenFillsByMonth')}</h3>
          <div className="rounded-xl border bg-white p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={kmBetweenFillsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={35} />
                <Tooltip formatter={(val) => `${val} km`} />
                <Bar dataKey="avgKm" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Service cost by month ───────────────────────────────────── */}
      {services.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('vehicles.stats.serviceCostByMonth')}</h3>
          <div className="rounded-xl border bg-white p-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyServiceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip formatter={(val) => formatCurrency(Math.round(Number(val) * 100), baseCurrency)} />
                <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Service cost by type (pie) ──────────────────────────────── */}
      {serviceCostByType.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('vehicles.stats.serviceCostByType')}</h3>
          <div className="rounded-xl border bg-white p-3">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={serviceCostByType}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={10}
                >
                  {serviceCostByType.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatCurrency(Math.round(Number(val) * 100), baseCurrency)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {logs.length === 0 && services.length === 0 && (
        <p className="text-sm text-gray-400 text-center mt-8">{t('vehicles.stats.noData')}</p>
      )}

      {/* ── Drill-down sheet ────────────────────────────────────────── */}
      <Sheet open={drill !== null} onOpenChange={(open) => { if (!open) setDrill(null) }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-0">
            <SheetTitle>{drillTitle}</SheetTitle>
          </SheetHeader>

          {/* Range selector */}
          <div className="flex gap-1.5 px-4 py-3 flex-wrap">
            {DRILL_RANGES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDrillRange(value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  drillRange === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          {drillData.length > 0 && activeDrill && (
            <div className="px-2 pb-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={drillData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={45} />
                  <Tooltip
                    formatter={(val) =>
                      activeDrill.isCurrency
                        ? formatCurrency(Math.round(Number(val) * 100), baseCurrency)
                        : `${val}${activeDrill.unit ? ` ${activeDrill.unit}` : ''}`
                    }
                  />
                  <Bar dataKey="value" fill={activeDrill.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary stats */}
          {activeDrill && (
            <div className="grid grid-cols-2 gap-3 px-4 pb-6">
              {drill !== 'km-per-fill' && (
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('vehicles.stats.drillTotal')}</p>
                  <p className="text-base font-bold text-gray-800">
                    {activeDrill.isCurrency
                      ? formatCurrency(Math.round(drillTotal * 100), baseCurrency)
                      : Math.round(drillTotal).toString()}
                  </p>
                </div>
              )}
              <div className={`rounded-xl bg-gray-50 px-3 py-2.5 text-center ${drill === 'km-per-fill' ? 'col-span-2' : ''}`}>
                <p className="text-[11px] text-gray-400 mb-0.5">{t('vehicles.stats.drillAvg')}</p>
                <p className="text-base font-bold text-gray-800">
                  {activeDrill.isCurrency
                    ? formatCurrency(Math.round(drillAvg * 100), baseCurrency)
                    : `${Math.round(drillAvg)}${activeDrill.unit ? ` ${activeDrill.unit}` : ''}`}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
