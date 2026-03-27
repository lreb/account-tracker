import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

import { formatCurrency } from '@/lib/currency'
import { calcKmSinceLastFill, getServiceTypeLabel } from '@/lib/vehicles'
import type { FuelLog, VehicleService } from '@/types'

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

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

  // Monthly fuel cost (last 12 months)
  const monthlyFuelData = useMemo(() => {
    const now = new Date()
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 11), end: startOfMonth(now) })
    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const monthLogs = logs.filter((l) => {
        const d = parseISO(l.date)
        return d >= monthStart && d <= monthEnd
      })
      const totalCost = monthLogs.reduce((sum, l) => sum + l.totalCost, 0)
      const totalLiters = monthLogs.reduce((sum, l) => sum + l.liters, 0)
      return {
        month: format(monthStart, 'MMM yy'),
        cost: totalCost / 100,
        liters: Math.round(totalLiters * 100) / 100,
        fillUps: monthLogs.length,
      }
    })
  }, [logs])

  // Monthly service cost (last 12 months)
  const monthlyServiceData = useMemo(() => {
    const now = new Date()
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(now), 11), end: startOfMonth(now) })
    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const monthSvcs = services.filter((s) => {
        const d = parseISO(s.date)
        return d >= monthStart && d <= monthEnd
      })
      const totalCost = monthSvcs.reduce((sum, s) => sum + s.cost, 0)
      return {
        month: format(monthStart, 'MMM yy'),
        cost: totalCost / 100,
        count: monthSvcs.length,
      }
    })
  }, [services])

  // Service cost by type (pie)
  const serviceCostByType = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of services) {
      map.set(s.serviceType, (map.get(s.serviceType) ?? 0) + s.cost)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: getServiceTypeLabel(name, t), value: value / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [services, t])

  // Summary stats
  const stats = useMemo(() => {
    const totalFuelCost = logs.reduce((s, l) => s + l.totalCost, 0)
    const totalServiceCost = services.reduce((s, sv) => s + sv.cost, 0)
    const totalLiters = logs.reduce((s, l) => s + l.liters, 0)
    const fillUpCount = logs.length

    // km/L average across all consecutive fills (single-vehicle mode)
    let totalKm = 0
    let totalLitersForEff = 0
    const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date))
    for (let i = 1; i < sortedLogs.length; i++) {
      const km = calcKmSinceLastFill(sortedLogs[i].odometer, sortedLogs[i - 1].odometer)
      if (km > 0) {
        totalKm += km
        totalLitersForEff += sortedLogs[i].liters
      }
    }
    const avgKmPerL = totalLitersForEff > 0 ? totalKm / totalLitersForEff : 0

    // Total distance (single-vehicle mode)
    const maxOdo = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].odometer : 0
    const minOdo = sortedLogs.length > 0 ? (initialOdometer || sortedLogs[0].odometer) : initialOdometer
    const totalDistance = Math.max(0, maxOdo - minOdo)

    return { totalFuelCost, totalServiceCost, totalLiters, fillUpCount, avgKmPerL, totalDistance }
  }, [logs, services, initialOdometer])

  // In fleet mode, overrides replace the internally computed values
  const displayAvgKmPerL = overrideAvgKmPerL ?? stats.avgKmPerL
  const displayTotalDistance = overrideTotalDistance ?? stats.totalDistance

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: t('vehicles.stats.totalFuelCost'), value: formatCurrency(stats.totalFuelCost, baseCurrency) },
          { label: t('vehicles.stats.totalServiceCost'), value: formatCurrency(stats.totalServiceCost, baseCurrency) },
          { label: t('vehicles.stats.totalCost'), value: formatCurrency(stats.totalFuelCost + stats.totalServiceCost, baseCurrency) },
          { label: t('vehicles.stats.avgKmPerL'), value: displayAvgKmPerL > 0 ? `${displayAvgKmPerL.toFixed(1)} km/L` : '—' },
          { label: t('vehicles.stats.totalDistance'), value: displayTotalDistance > 0 ? `${displayTotalDistance.toLocaleString()} km` : '—' },
          { label: t('vehicles.stats.fillUps'), value: stats.fillUpCount.toString() },
          { label: t('vehicles.stats.totalLiters'), value: `${stats.totalLiters.toFixed(1)} L` },
          { label: t('vehicles.stats.serviceCount'), value: services.length.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-sm font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Fuel cost by month */}
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

      {/* Fill-ups per month */}
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

      {/* Service cost by month */}
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

      {/* Service cost breakdown by type (pie) */}
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
    </div>
  )
}
