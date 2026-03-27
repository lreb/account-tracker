import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ArrowLeft, Trash2, Pencil, Gauge, TrendingDown, Fuel, Wrench } from 'lucide-react'

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
import { AddFabMenu } from '@/components/ui/add-fab-menu'
import { VehicleStats } from './VehicleStats'

// ─── Page ───────────────────────────────────────────── (stats live in VehicleStats.tsx) ───

type Tab = 'all' | 'fuel' | 'service' | 'stats'

type CombinedEntry =
  | { kind: 'fuel'; log: FuelLog; prevOdometer: number | null }
  | { kind: 'service'; svc: VehicleService }

let persistedTab: Tab = 'all'

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
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 mb-4">
        {([
          { key: 'all' as Tab, label: t('vehicles.tabAll') },
          { key: 'fuel' as Tab, label: t('vehicles.tabFuel') },
          { key: 'service' as Tab, label: t('vehicles.tabService') },
          { key: 'stats' as Tab, label: t('vehicles.tabStats') },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
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

      <ScrollToTopButton />
      <AddFabMenu vehicleId={vehicle.id} />
    </div>
  )
}
