import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import { ArrowLeft, Plus, Trash2, Pencil, Gauge, TrendingDown, Fuel } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'

import {
  getVisibleAccountIds,
  isTransactionForVisiblePrimaryAccount,
} from '@/lib/accounts'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLabelsStore } from '@/stores/labels.store'
import { formatCurrency } from '@/lib/currency'
import {
  calcKmPerLiter,
  calcCostPerKm,
  calcKmSinceLastFill,
  getServiceTypeLabel,
} from '@/lib/vehicles'
import type { FuelLog, VehicleService } from '@/types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'

// Palette for charts
const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

// ─── Stats tab ────────────────────────────────────────────────────────────────

function VehicleStats({
  logs,
  services,
  baseCurrency,
  initialOdometer,
}: {
  logs: FuelLog[]
  services: VehicleService[]
  baseCurrency: string
  initialOdometer: number
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

    // km/L average across all consecutive fills
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

    // Total distance
    const maxOdo = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].odometer : 0
    const minOdo = sortedLogs.length > 0 ? (initialOdometer || sortedLogs[0].odometer) : initialOdometer
    const totalDistance = Math.max(0, maxOdo - minOdo)

    return { totalFuelCost, totalServiceCost, totalLiters, fillUpCount, avgKmPerL, totalDistance }
  }, [logs, services, initialOdometer])

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: t('vehicles.stats.totalFuelCost'), value: formatCurrency(stats.totalFuelCost, baseCurrency) },
          { label: t('vehicles.stats.totalServiceCost'), value: formatCurrency(stats.totalServiceCost, baseCurrency) },
          { label: t('vehicles.stats.totalCost'), value: formatCurrency(stats.totalFuelCost + stats.totalServiceCost, baseCurrency) },
          { label: t('vehicles.stats.avgKmPerL'), value: stats.avgKmPerL > 0 ? `${stats.avgKmPerL.toFixed(1)} km/L` : '—' },
          { label: t('vehicles.stats.totalDistance'), value: stats.totalDistance > 0 ? `${stats.totalDistance.toLocaleString()} km` : '—' },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'fuel' | 'service' | 'stats'

export default function VehicleDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { vehicles, fuelLogs, vehicleServices, removeFuelLog, removeService } = useVehiclesStore()
  const { transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()
  const { labels } = useLabelsStore()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'fuel')

  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])
  const visibleTransactionIds = useMemo(() => {
    return new Set(
      transactions
        .filter((transaction) => isTransactionForVisiblePrimaryAccount(transaction, visibleAccountIds))
        .map((transaction) => transaction.id),
    )
  }, [transactions, visibleAccountIds])

  const vehicle = vehicles.find((v) => v.id === id)
  const logs = fuelLogs.filter((fuelLog) => {
    if (fuelLog.vehicleId !== id) return false
    if (!fuelLog.transactionId) return true
    return visibleTransactionIds.has(fuelLog.transactionId)
  })
  const services = vehicleServices.filter((service) => {
    if (service.vehicleId !== id) return false
    if (!service.transactionId) return true
    return visibleTransactionIds.has(service.transactionId)
  })

  if (!vehicle) {
    return (
      <div className="p-4 text-center mt-16">
        <p className="text-sm text-gray-400">{t('vehicles.notFound')}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/vehicles')}>
          {t('vehicles.backToList')}
        </Button>
      </div>
    )
  }

  // Stats from the most recent two fills
  const lastLog = logs[0]
  const prevLog = logs[1]
  const kmSince = lastLog && prevLog ? calcKmSinceLastFill(lastLog.odometer, prevLog.odometer) : null
  const kmPerL = lastLog && kmSince ? calcKmPerLiter(kmSince, lastLog.liters) : null
  const costPerKm = lastLog && kmSince ? calcCostPerKm(lastLog.totalCost, kmSince) : null

  return (
    <div className="p-4 pb-24">
      {/* Back + header */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => navigate('/vehicles')}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{vehicle.name}</h1>
          <p className="text-xs text-gray-400">
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || t('vehicles.noDetails')}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {kmPerL !== null && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: <Gauge size={16} />, label: 'km/L', value: kmPerL.toFixed(1) },
            { icon: <TrendingDown size={16} />, label: t('vehicles.costPerKm'), value: costPerKm ? formatCurrency(costPerKm, baseCurrency) : '—' },
            { icon: <Fuel size={16} />, label: t('vehicles.lastKm'), value: kmSince?.toString() ?? '—' },
          ].map(({ icon, label, value }) => (
            <div key={label} className="rounded-xl border bg-white px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                {icon}
                <span className="text-[10px] uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 mb-4">
        {([
          { key: 'fuel' as Tab, label: t('vehicles.fuelLogs') },
          { key: 'service' as Tab, label: t('vehicles.services') },
          { key: 'stats' as Tab, label: t('vehicles.stats.title') },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fuel logs tab */}
      {tab === 'fuel' && (
        <>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => navigate(`/vehicles/${vehicle.id}/fuel/new`)} className="gap-1">
              <Plus size={14} /> {t('vehicles.addFillUp')}
            </Button>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">{t('vehicles.noFuelLogs')}</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log, idx) => {
                const prev = logs[idx + 1]
                const km = prev ? calcKmSinceLastFill(log.odometer, prev.odometer) : null
                const eff = km ? calcKmPerLiter(km, log.liters) : null
                const linkedTx = log.transactionId
                  ? useTransactionsStore.getState().transactions.find((tx) => tx.id === log.transactionId)
                  : undefined
                const txLabels = linkedTx?.labels ?? []
                return (
                  <li key={log.id} className="rounded-2xl border bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {format(new Date(log.date), 'MMM d, yyyy · h:mm a')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.liters.toFixed(2)} L · {formatCurrency(log.totalCost, baseCurrency)}
                          {km !== null && ` · ${km} km`}
                          {eff !== null && ` · ${eff.toFixed(1)} km/L`}
                        </p>
                        <p className="text-xs text-gray-400">{t('vehicles.odometer')}: {log.odometer.toLocaleString()} km</p>
                        {log.notes && <p className="text-xs text-gray-400 truncate">{log.notes}</p>}
                        {txLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {txLabels.map((lid) => {
                              const lbl = labels.find((l) => l.id === lid)
                              if (!lbl) return null
                              return (
                                <span key={lid} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                                  style={{ borderColor: lbl.color ?? '#6b7280', color: lbl.color ?? '#6b7280', backgroundColor: `${lbl.color ?? '#6b7280'}18` }}>
                                  {lbl.name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700"
                          onClick={() => navigate(`/vehicles/${vehicle.id}/fuel/${log.id}`)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => removeFuelLog(log.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </>
      )}

      {/* Services tab */}
      {tab === 'service' && (
        <>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => navigate(`/vehicles/${vehicle.id}/service/new`)} className="gap-1">
              <Plus size={14} /> {t('vehicles.addServiceBtn')}
            </Button>
          </div>
          {services.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">{t('vehicles.noServices')}</p>
          ) : (
            <ul className="space-y-2">
              {services.map((svc) => {
                const linkedTx = svc.transactionId
                  ? useTransactionsStore.getState().transactions.find((tx) => tx.id === svc.transactionId)
                  : undefined
                const txLabels = linkedTx?.labels ?? []
                return (
                  <li key={svc.id} className="rounded-2xl border bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{getServiceTypeLabel(svc.serviceType, t)}</p>
                          {svc.nextServiceKm && (
                            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                              {t('vehicles.nextAt')}: {svc.nextServiceKm.toLocaleString()} km
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {format(new Date(svc.date), 'MMM d, yyyy · h:mm a')} · {formatCurrency(svc.cost, baseCurrency)} · {svc.odometer.toLocaleString()} km
                        </p>
                        {svc.notes && <p className="text-xs text-gray-400 truncate">{svc.notes}</p>}
                        {txLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {txLabels.map((lid) => {
                              const lbl = labels.find((l) => l.id === lid)
                              if (!lbl) return null
                              return (
                                <span key={lid} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                                  style={{ borderColor: lbl.color ?? '#6b7280', color: lbl.color ?? '#6b7280', backgroundColor: `${lbl.color ?? '#6b7280'}18` }}>
                                  {lbl.name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700"
                          onClick={() => navigate(`/vehicles/${vehicle.id}/service/${svc.id}`)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => removeService(svc.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </>
      )}

      {/* Stats tab */}
      {tab === 'stats' && (
        <VehicleStats
          logs={logs}
          services={services}
          baseCurrency={baseCurrency}
          initialOdometer={vehicle.initialOdometer ?? 0}
        />
      )}

      <ScrollToTopButton />
    </div>
  )
}
