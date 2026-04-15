import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO, addDays } from 'date-fns'
import { ArrowLeft, Trash2, Pencil, Gauge, TrendingDown, Fuel, Wrench, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { AddFabMenu } from '@/components/ui/add-fab-menu'
import { VehicleStats } from './VehicleStats'

// ─── Page ───────────────────────────────────────────── (stats live in VehicleStats.tsx) ───

type Tab = 'all' | 'fuel' | 'service' | 'stats' | 'upcoming'

interface UpcomingServiceItem {
  svc: VehicleService
  urgency: 'overdue' | 'soon' | 'upcoming'
  kmRemaining: number | null
  dueDate: Date | null
}

type CombinedEntry =
  | { kind: 'fuel'; log: FuelLog; prevOdometer: number | null }
  | { kind: 'service'; svc: VehicleService }

let persistedTab: Tab = 'all'

// ─── Stat card with auto-dismiss tooltip (3 s) ───────────────────────────────

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  tooltip: string
}

function StatCard({ icon, label, value, tooltip }: StatCardProps) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleOpenChange(next: boolean) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(next)
    if (next) {
      timerRef.current = setTimeout(() => setOpen(false), 3000)
    }
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <div className="rounded-xl border bg-white px-3 py-2 text-center cursor-default">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
            {icon}
            <span className="text-[10px] uppercase tracking-wide">{label}</span>
          </div>
          <p className="text-sm font-bold">{value}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export default function VehicleDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { vehicles, fuelLogs, vehicleServices, removeFuelLog, removeService } = useVehiclesStore()
  const { transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()
  const { labels } = useLabelsStore()
  const [tab, setTab] = useState<Tab>(persistedTab)
  useEffect(() => { persistedTab = tab }, [tab])

  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])
  const visibleTransactionIds = useMemo(() => {
    return new Set(
      transactions
        .filter((transaction) => isTransactionForVisiblePrimaryAccount(transaction, visibleAccountIds))
        .map((transaction) => transaction.id),
    )
  }, [transactions, visibleAccountIds])

  const vehicle = vehicles.find((v) => v.id === id)
  const logs = fuelLogs
    .filter((fuelLog) => {
      if (fuelLog.vehicleId !== id) return false
      if (!fuelLog.transactionId) return true
      return visibleTransactionIds.has(fuelLog.transactionId)
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  const services = vehicleServices
    .filter((service) => {
      if (service.vehicleId !== id) return false
      if (!service.transactionId) return true
      return visibleTransactionIds.has(service.transactionId)
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  // Hooks must be before the early return
  const currentOdometer = useMemo(
    () => (logs.length > 0 ? Math.max(...logs.map((l) => l.odometer)) : 0),
    [logs],
  )

  const upcomingServices = useMemo((): UpcomingServiceItem[] => {
    // Track the most recent service per type (regardless of scheduling info).
    // If the latest record has no nextServiceKm / nextServiceDate the alert is dismissed.
    const byType = new Map<string, VehicleService>()
    for (const svc of [...services].sort((a, b) => a.date.localeCompare(b.date))) {
      byType.set(svc.serviceType, svc)
    }
    const today    = new Date()
    const soonDate = addDays(today, 30)
    return Array.from(byType.values())
      .filter((svc) => svc.nextServiceKm != null || svc.nextServiceDate)
      .map((svc): UpcomingServiceItem => {
        const kmRemaining = svc.nextServiceKm != null ? svc.nextServiceKm - currentOdometer : null
        const dueDate     = svc.nextServiceDate ? parseISO(svc.nextServiceDate) : null
        let urgency: UpcomingServiceItem['urgency'] = 'upcoming'
        if ((kmRemaining !== null && kmRemaining <= 0) || (dueDate !== null && dueDate < today)) {
          urgency = 'overdue'
        } else if ((kmRemaining !== null && kmRemaining <= 500) || (dueDate !== null && dueDate <= soonDate)) {
          urgency = 'soon'
        }
        return { svc, urgency, kmRemaining, dueDate }
      })
      .sort((a, b) => ({ overdue: 0, soon: 1, upcoming: 2 }[a.urgency] - { overdue: 0, soon: 1, upcoming: 2 }[b.urgency]))
  }, [services, currentOdometer])

  const urgentCount = upcomingServices.filter((i) => i.urgency === 'overdue' || i.urgency === 'soon').length

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

  const combined: CombinedEntry[] = [
    ...logs.map((log, idx) => ({ kind: 'fuel' as const, log, prevOdometer: logs[idx + 1]?.odometer ?? null })),
    ...services.map((svc) => ({ kind: 'service' as const, svc })),
  ].sort((a, b) => {
    const da = a.kind === 'fuel' ? a.log.date : a.svc.date
    const db = b.kind === 'fuel' ? b.log.date : b.svc.date
    return db.localeCompare(da)
  })

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
        <TooltipProvider delayDuration={0}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatCard
              icon={<Gauge size={16} />}
              label="km/L"
              value={kmPerL.toFixed(1)}
              tooltip={t('vehicles.tooltips.kmPerL')}
            />
            <StatCard
              icon={<TrendingDown size={16} />}
              label={t('vehicles.costPerKm')}
              value={costPerKm ? formatCurrency(costPerKm, baseCurrency) : '—'}
              tooltip={t('vehicles.tooltips.costPerKm')}
            />
            <StatCard
              icon={<Fuel size={16} />}
              label={t('vehicles.lastKm')}
              value={kmSince?.toString() ?? '—'}
              tooltip={t('vehicles.tooltips.lastKm')}
            />
          </div>
        </TooltipProvider>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 mb-4">
        {([
          { key: 'all' as Tab, label: t('vehicles.tabAll') },
          { key: 'fuel' as Tab, label: t('vehicles.tabFuel') },
          { key: 'service' as Tab, label: t('vehicles.tabService') },
          { key: 'stats' as Tab, label: t('vehicles.tabStats') },
          { key: 'upcoming' as Tab, label: t('vehicles.tabUpcoming') },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative rounded-lg py-1.5 text-xs font-medium transition-colors ${
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {key === 'upcoming' && urgentCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white leading-none">
                {urgentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* All activity tab */}
      {tab === 'all' && (
        <>
          {combined.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">{t('vehicles.stats.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {combined.map((item) => {
                if (item.kind === 'fuel') {
                  const { log, prevOdometer } = item
                  const km = prevOdometer !== null ? calcKmSinceLastFill(log.odometer, prevOdometer) : null
                  const eff = km ? calcKmPerLiter(km, log.liters) : null
                  const linkedTx = log.transactionId
                    ? useTransactionsStore.getState().transactions.find((tx) => tx.id === log.transactionId)
                    : undefined
                  const txLabels = linkedTx?.labels ?? []
                  return (
                    <li key={`fuel-${log.id}`} className="rounded-2xl border bg-white px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 mt-0.5">
                          <Fuel size={15} className="text-blue-500" />
                        </span>
                        <div className="flex-1 min-w-0">
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
                        </div>
                      </div>
                    </li>
                  )
                }
                const { svc } = item
                const linkedTx = svc.transactionId
                  ? useTransactionsStore.getState().transactions.find((tx) => tx.id === svc.transactionId)
                  : undefined
                const txLabels = linkedTx?.labels ?? []
                return (
                  <li key={`service-${svc.id}`} className="rounded-2xl border bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 mt-0.5">
                        <Wrench size={15} className="text-orange-500" />
                      </span>
                      <div className="flex-1 min-w-0">
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
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* Fuel logs tab */}
      {tab === 'fuel' && (
        <>
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

      {/* Upcoming services tab */}
      {tab === 'upcoming' && (
        upcomingServices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">{t('vehicles.noUpcoming')}</p>
        ) : (
          <div className="space-y-2">
            {upcomingServices.map(({ svc, urgency, kmRemaining, dueDate }) => {
              const bgClass =
                urgency === 'overdue' ? 'bg-red-50 border-red-200'
                : urgency === 'soon'  ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
              const textClass =
                urgency === 'overdue' ? 'text-red-700'
                : urgency === 'soon'  ? 'text-amber-700'
                : 'text-emerald-700'
              const badgeBg =
                urgency === 'overdue' ? 'bg-red-100 text-red-700'
                : urgency === 'soon'  ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
              const UrgencyIcon =
                urgency === 'overdue' ? AlertCircle
                : urgency === 'soon'  ? Clock
                : CheckCircle2
              const urgencyLabel =
                urgency === 'overdue' ? t('vehicles.stats.overdue')
                : urgency === 'soon'  ? t('vehicles.stats.dueSoon')
                : t('vehicles.stats.upcomingLabel')

              return (
                <div key={svc.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${bgClass}`}>
                  <UrgencyIcon size={14} className={`${textClass} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${textClass}`}>
                        {getServiceTypeLabel(svc.serviceType, t)}
                      </p>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${badgeBg}`}>
                        {urgencyLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {svc.nextServiceKm != null && (
                        <p className={`text-xs ${textClass} opacity-80`}>
                          {t('vehicles.stats.dueAt', { km: svc.nextServiceKm.toLocaleString() })}
                          {kmRemaining !== null && kmRemaining > 0 && (
                            <span className="ml-1 opacity-70">
                              ({t('vehicles.stats.kmLeft', { km: kmRemaining.toLocaleString() })})
                            </span>
                          )}
                        </p>
                      )}
                      {dueDate && (
                        <p className={`text-xs ${textClass} opacity-80`}>
                          {t('vehicles.stats.dueOn', { date: format(dueDate, 'MMM d, yyyy') })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700"
                        onClick={() => navigate(`/vehicles/${vehicle.id}/service/${svc.id}`)}>
                        <Pencil size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      <ScrollToTopButton />
      <AddFabMenu vehicleId={vehicle.id} />
    </div>
  )
}
