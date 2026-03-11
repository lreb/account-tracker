import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { ArrowLeft, Plus, Fuel, Wrench, Trash2, Gauge, TrendingDown } from 'lucide-react'

import {
  fuelLogSchema,
  vehicleServiceSchema,
  type FuelLogFormValues,
  type VehicleServiceFormValues,
} from '../schemas/vehicle.schema'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatCurrency } from '@/lib/currency'
import { calcKmPerLiter, calcCostPerKm, calcKmSinceLastFill } from '@/lib/vehicles'
import type { FuelLog, VehicleService } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ─── Add Fuel Log dialog ──────────────────────────────────────────────────────

function FuelLogDialog({
  open,
  vehicleId,
  lastOdometer,
  onClose,
}: {
  open: boolean
  vehicleId: string
  lastOdometer: number
  onClose: () => void
}) {
  const { addFuelLog } = useVehiclesStore()
  const { baseCurrency } = useSettingsStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FuelLogFormValues>({
    resolver: zodResolver(fuelLogSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), liters: '', totalCost: '', odometer: '' },
  })

  const onSubmit = async (values: FuelLogFormValues) => {
    const log: FuelLog = {
      id: uuid(),
      vehicleId,
      date: new Date(values.date).toISOString(),
      liters: parseFloat(values.liters),
      totalCost: Math.round(parseFloat(values.totalCost) * 100),
      odometer: parseInt(values.odometer, 10),
    }
    await addFuelLog(log)
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Fuel Log</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="fDate">Date</Label>
            <Input id="fDate" type="date" {...register('date')} />
            {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fLiters">Liters</Label>
              <Input id="fLiters" type="number" step="0.001" inputMode="decimal" placeholder="40.000" {...register('liters')} />
              {errors.liters && <p className="text-xs text-red-500">{errors.liters.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="fCost">Total Cost ({baseCurrency})</Label>
              <Input id="fCost" type="number" step="0.01" inputMode="decimal" placeholder="0.00" {...register('totalCost')} />
              {errors.totalCost && <p className="text-xs text-red-500">{errors.totalCost.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fOdo">Odometer (km)</Label>
            <Input id="fOdo" type="number" inputMode="numeric" placeholder={lastOdometer > 0 ? `Last: ${lastOdometer}` : '0'} {...register('odometer')} />
            {errors.odometer && <p className="text-xs text-red-500">{errors.odometer.message}</p>}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Service dialog ───────────────────────────────────────────────────────

function ServiceDialog({
  open,
  vehicleId,
  onClose,
}: {
  open: boolean
  vehicleId: string
  onClose: () => void
}) {
  const { addService } = useVehiclesStore()
  const { baseCurrency } = useSettingsStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleServiceFormValues>({
    resolver: zodResolver(vehicleServiceSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), serviceType: '', cost: '', odometer: '' },
  })

  const onSubmit = async (values: VehicleServiceFormValues) => {
    const svc: VehicleService = {
      id: uuid(),
      vehicleId,
      date: new Date(values.date).toISOString(),
      serviceType: values.serviceType,
      cost: Math.round(parseFloat(values.cost) * 100),
      odometer: parseInt(values.odometer, 10),
      notes: values.notes || undefined,
      nextServiceKm: values.nextServiceKm ? parseInt(values.nextServiceKm, 10) : undefined,
      nextServiceDate: values.nextServiceDate ? new Date(values.nextServiceDate).toISOString() : undefined,
    }
    await addService(svc)
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Service Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="sDate">Date</Label>
            <Input id="sDate" type="date" {...register('date')} />
            {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="sType">Service Type</Label>
            <Input id="sType" placeholder="e.g. Oil change, Tire rotation" {...register('serviceType')} />
            {errors.serviceType && <p className="text-xs text-red-500">{errors.serviceType.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sCost">Cost ({baseCurrency})</Label>
              <Input id="sCost" type="number" step="0.01" inputMode="decimal" placeholder="0.00" {...register('cost')} />
              {errors.cost && <p className="text-xs text-red-500">{errors.cost.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sOdo">Odometer (km)</Label>
              <Input id="sOdo" type="number" inputMode="numeric" placeholder="0" {...register('odometer')} />
              {errors.odometer && <p className="text-xs text-red-500">{errors.odometer.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sNotes">Notes</Label>
            <Textarea id="sNotes" rows={2} placeholder="Optional…" {...register('notes')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sNextKm">Next service (km)</Label>
              <Input id="sNextKm" type="number" inputMode="numeric" placeholder="Optional" {...register('nextServiceKm')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sNextDate">Next service (date)</Label>
              <Input id="sNextDate" type="date" {...register('nextServiceDate')} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'fuel' | 'service'

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { vehicles, fuelLogs, vehicleServices, removeFuelLog, removeService } = useVehiclesStore()
  const { baseCurrency } = useSettingsStore()
  const [tab, setTab] = useState<Tab>('fuel')
  const [fuelDialog, setFuelDialog] = useState(false)
  const [serviceDialog, setServiceDialog] = useState(false)

  const vehicle = vehicles.find((v) => v.id === id)
  const logs = fuelLogs.filter((f) => f.vehicleId === id)
  const services = vehicleServices.filter((s) => s.vehicleId === id)

  if (!vehicle) {
    return (
      <div className="p-4 text-center mt-16">
        <p className="text-sm text-gray-400">Vehicle not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/vehicles')}>
          Back to Vehicles
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
    <div className="p-4">
      {/* Back + header */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => navigate('/vehicles')}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{vehicle.name}</h1>
          <p className="text-xs text-gray-400">
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'No details'}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {kmPerL !== null && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: <Gauge size={16} />, label: 'km/L', value: kmPerL.toFixed(1) },
            { icon: <TrendingDown size={16} />, label: 'cost/km', value: costPerKm ? formatCurrency(costPerKm, baseCurrency) : '—' },
            { icon: <Fuel size={16} />, label: 'last km', value: kmSince?.toString() ?? '—' },
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
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 mb-4">
        {(['fuel', 'service'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg py-1.5 text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'fuel' ? 'Fuel Logs' : 'Services'}
          </button>
        ))}
      </div>

      {/* Fuel logs tab */}
      {tab === 'fuel' && (
        <>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setFuelDialog(true)} className="gap-1">
              <Plus size={14} /> Add Fill-up
            </Button>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">No fuel logs yet.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log, idx) => {
                const prev = logs[idx + 1]
                const km = prev ? calcKmSinceLastFill(log.odometer, prev.odometer) : null
                const eff = km ? calcKmPerLiter(km, log.liters) : null
                return (
                  <li key={log.id} className="rounded-2xl border bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{format(new Date(log.date), 'MMM d, yyyy')}</p>
                        <p className="text-xs text-gray-500">
                          {log.liters.toFixed(2)} L · {formatCurrency(log.totalCost, baseCurrency)}
                          {km !== null && ` · ${km} km`}
                          {eff !== null && ` · ${eff.toFixed(1)} km/L`}
                        </p>
                        <p className="text-xs text-gray-400">Odometer: {log.odometer.toLocaleString()} km</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0"
                        onClick={() => removeFuelLog(log.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <FuelLogDialog
            open={fuelDialog}
            vehicleId={vehicle.id}
            lastOdometer={logs[0]?.odometer ?? 0}
            onClose={() => setFuelDialog(false)}
          />
        </>
      )}

      {/* Services tab */}
      {tab === 'service' && (
        <>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setServiceDialog(true)} className="gap-1">
              <Plus size={14} /> Add Service
            </Button>
          </div>
          {services.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">No service records yet.</p>
          ) : (
            <ul className="space-y-2">
              {services.map((svc) => (
                <li key={svc.id} className="rounded-2xl border bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{svc.serviceType}</p>
                        {svc.nextServiceKm && (
                          <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                            Next: {svc.nextServiceKm.toLocaleString()} km
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(new Date(svc.date), 'MMM d, yyyy')} · {formatCurrency(svc.cost, baseCurrency)} · {svc.odometer.toLocaleString()} km
                      </p>
                      {svc.notes && <p className="text-xs text-gray-400 truncate">{svc.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0"
                      onClick={() => removeService(svc.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ServiceDialog
            open={serviceDialog}
            vehicleId={vehicle.id}
            onClose={() => setServiceDialog(false)}
          />
        </>
      )}
    </div>
  )
}
