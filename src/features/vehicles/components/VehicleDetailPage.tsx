import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { ArrowLeft, Plus, Trash2, Pencil, Gauge, TrendingDown, Fuel, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'

import {
  fuelLogSchema,
  vehicleServiceSchema,
  SERVICE_TYPES,
  type FuelLogFormValues,
  type VehicleServiceFormValues,
} from '../schemas/vehicle.schema'
import {
  getAccountSelectOptions,
  getVisibleAccountIds,
  getVisibleAccounts,
  isTransactionForVisiblePrimaryAccount,
} from '@/lib/accounts'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLabelsStore } from '@/stores/labels.store'
import { formatCurrency } from '@/lib/currency'
import { calcKmPerLiter, calcCostPerKm, calcKmSinceLastFill } from '@/lib/vehicles'
import type { FuelLog, VehicleService, Transaction } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// Palette for charts
const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

// ─── Fuel Log dialog (add + edit) ────────────────────────────────────────────

function FuelLogDialog({
  open,
  vehicleId,
  vehicleName,
  lastOdometer,
  editing,
  onClose,
}: {
  open: boolean
  vehicleId: string
  vehicleName: string
  lastOdometer: number
  editing?: FuelLog
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { addFuelLog, updateFuelLog } = useVehiclesStore()
  const { add: addTransaction } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  useEffect(() => { loadLabels() }, [loadLabels])

  const defaultAccount = visibleAccounts[0] ?? accounts[0]
  const fuelCategory = categories.find((c) => c.id === 'fuel-gas') ?? categories[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FuelLogFormValues>({
    resolver: zodResolver(fuelLogSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      liters: '',
      costPerLiter: '',
      totalCost: '',
      odometer: '',
      accountId: defaultAccount?.id ?? '',
      categoryId: fuelCategory?.id ?? '',
      status: 'cleared',
      notes: '',
      labels: [],
    },
  })

  const watchAccountId = watch('accountId')
  const watchCategoryId = watch('categoryId')
  const watchStatus = watch('status')
  const watchLabels = watch('labels') ?? []
  const watchLiters = watch('liters')
  const watchCostPerLiter = watch('costPerLiter')
  const watchTotalCost = watch('totalCost')
  const availableAccounts = useMemo(
    () => getAccountSelectOptions(accounts, [watchAccountId]),
    [accounts, watchAccountId],
  )

  // Auto-calc total cost when liters + cost/liter change
  const [lastEdited, setLastEdited] = useState<'costPerLiter' | 'totalCost'>('costPerLiter')

  useEffect(() => {
    const liters = parseFloat(watchLiters)
    if (isNaN(liters) || liters <= 0) return
    if (lastEdited === 'costPerLiter') {
      const cpl = parseFloat(watchCostPerLiter)
      if (!isNaN(cpl) && cpl > 0) {
        const total = (liters * cpl).toFixed(2)
        if (total !== watchTotalCost) setValue('totalCost', total, { shouldValidate: true })
      }
    } else {
      const total = parseFloat(watchTotalCost)
      if (!isNaN(total) && total > 0) {
        const cpl = (total / liters).toFixed(4)
        if (cpl !== watchCostPerLiter) setValue('costPerLiter', cpl, { shouldValidate: true })
      }
    }
  }, [watchLiters, watchCostPerLiter, watchTotalCost, lastEdited, setValue])

  useEffect(() => {
    if (!open) return
    if (editing) {
      const existingTx = editing.transactionId
        ? useTransactionsStore.getState().transactions.find((tx) => tx.id === editing.transactionId)
        : undefined
      const cpl = editing.liters > 0 ? ((editing.totalCost / 100) / editing.liters).toFixed(4) : ''
      reset({
        date: format(new Date(editing.date), 'yyyy-MM-dd'),
        time: format(new Date(editing.date), 'HH:mm'),
        liters: editing.liters.toString(),
        costPerLiter: cpl,
        totalCost: (editing.totalCost / 100).toFixed(2),
        odometer: editing.odometer.toString(),
        accountId: existingTx?.accountId ?? defaultAccount?.id ?? '',
        categoryId: existingTx?.categoryId ?? fuelCategory?.id ?? '',
        status: existingTx?.status ?? 'cleared',
        notes: editing.notes ?? existingTx?.notes ?? '',
        labels: existingTx?.labels ?? [],
      })
    } else {
      reset({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        liters: '',
        costPerLiter: '',
        totalCost: '',
        odometer: '',
        accountId: defaultAccount?.id ?? '',
        categoryId: fuelCategory?.id ?? '',
        status: 'cleared',
        notes: '',
        labels: [],
      })
    }
  }, [open, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLabel = (labelId: string) => {
    const current = watchLabels
    const next = current.includes(labelId) ? current.filter((l) => l !== labelId) : [...current, labelId]
    setValue('labels', next)
  }

  const onSubmit = async (values: FuelLogFormValues) => {
    const account = accounts.find((a) => a.id === values.accountId)
    const costCents = Math.round(parseFloat(values.totalCost) * 100)
    const [y, m, d] = values.date.split('-').map(Number)
    const [hh, mm] = values.time.split(':').map(Number)
    const isoDate = new Date(y, m - 1, d, hh, mm).toISOString()

    if (editing) {
      const updatedLog: FuelLog = {
        ...editing,
        date: isoDate,
        liters: parseFloat(values.liters),
        totalCost: costCents,
        odometer: parseInt(values.odometer, 10),
        notes: values.notes || undefined,
      }
      let linkedTx: Transaction | undefined
      if (editing.transactionId) {
        const existingTx = useTransactionsStore.getState().transactions.find(
          (tx) => tx.id === editing.transactionId,
        )
        if (existingTx) {
          linkedTx = {
            ...existingTx,
            amount: costCents,
            date: isoDate,
            categoryId: values.categoryId,
            accountId: values.accountId,
            description: `${t('vehicles.fuelFillUp')} – ${parseFloat(values.liters).toFixed(2)} L · ${vehicleName}`,
            notes: values.notes || undefined,
            status: values.status,
            labels: values.labels ?? [],
            currency: account?.currency ?? baseCurrency,
          }
        }
      }
      await updateFuelLog(updatedLog, linkedTx)
    } else {
      const txId = uuid()
      const logId = uuid()
      await addTransaction({
        id: txId,
        type: 'expense',
        amount: costCents,
        date: isoDate,
        categoryId: values.categoryId,
        accountId: values.accountId,
        description: `${t('vehicles.fuelFillUp')} – ${parseFloat(values.liters).toFixed(2)} L · ${vehicleName}`,
        notes: values.notes || undefined,
        status: values.status,
        currency: account?.currency ?? baseCurrency,
        labels: values.labels ?? [],
      })
      await addFuelLog({
        id: logId,
        vehicleId,
        date: isoDate,
        liters: parseFloat(values.liters),
        totalCost: costCents,
        odometer: parseInt(values.odometer, 10),
        notes: values.notes || undefined,
        transactionId: txId,
      })
    }
    reset()
    onClose()
  }

  const filteredCategories = categories.filter((c) => !c.deletedAt && (c.type === 'expense' || c.type === 'any'))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('vehicles.editFuelLog') : t('vehicles.addFuelLog')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>{t('transactions.date')}</FormLabel>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-red-500">{t(errors.date.message!)}</p>}
            </div>
            <div className="space-y-1">
              <FormLabel>{t('transactions.time')}</FormLabel>
              <Input type="time" {...register('time')} />
              {errors.time && <p className="text-xs text-red-500">{t(errors.time.message!)}</p>}
            </div>
          </div>

          {/* Odometer */}
          <div className="space-y-1">
            <FormLabel>{t('vehicles.odometer')}</FormLabel>
            <Input type="number" inputMode="numeric" placeholder={lastOdometer > 0 ? `${t('vehicles.last')}: ${lastOdometer}` : '0'} {...register('odometer')} />
            {errors.odometer && <p className="text-xs text-red-500">{t(errors.odometer.message!)}</p>}
          </div>

          {/* Liters + Cost per liter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>{t('vehicles.liters')}</FormLabel>
              <Input type="number" step="0.001" inputMode="decimal" placeholder="40.000" {...register('liters')} />
              {errors.liters && <p className="text-xs text-red-500">{t(errors.liters.message!)}</p>}
            </div>
            <div className="space-y-1">
              <FormLabel>{t('vehicles.costPerLiter')}</FormLabel>
              <Input
                type="number"
                step="0.0001"
                inputMode="decimal"
                placeholder="0.0000"
                {...register('costPerLiter', { onChange: () => setLastEdited('costPerLiter') })}
              />
              {errors.costPerLiter && <p className="text-xs text-red-500">{t(errors.costPerLiter.message!)}</p>}
            </div>
          </div>

          {/* Total cost */}
          <div className="space-y-1">
            <FormLabel>{t('vehicles.totalCost')}</FormLabel>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('totalCost', { onChange: () => setLastEdited('totalCost') })}
            />
            {errors.totalCost && <p className="text-xs text-red-500">{t(errors.totalCost.message!)}</p>}
          </div>

          {/* Account */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.account')}</FormLabel>
            <Select value={watchAccountId || ''} onValueChange={(v) => setValue('accountId', v as string)}>
              <SelectTrigger><SelectValue>{accounts.find((a) => a.id === watchAccountId)?.name ?? t('transactions.selectAccount')}</SelectValue></SelectTrigger>
              <SelectContent>
                {availableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountId && <p className="text-xs text-red-500">{t(errors.accountId.message!)}</p>}
          </div>

          {/* Category */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.category')}</FormLabel>
            <Select value={watchCategoryId || ''} onValueChange={(v) => setValue('categoryId', v as string)}>
              <SelectTrigger><SelectValue>{filteredCategories.find((c) => c.id === watchCategoryId)?.name ?? t('transactions.selectCategory')}</SelectValue></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-xs text-red-500">{t(errors.categoryId.message!)}</p>}
          </div>

          {/* Status */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.statusLabel')}</FormLabel>
            <Select value={watchStatus} onValueChange={(v) => setValue('status', v as FuelLogFormValues['status'])}>
              <SelectTrigger><SelectValue>{t(`transactions.status.${watchStatus}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {(['cleared', 'pending', 'reconciled', 'cancelled'] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`transactions.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="space-y-1">
              <FormLabel>{t('transactions.labels')}</FormLabel>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((lbl) => {
                  const active = watchLabels.includes(lbl.id)
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabel(lbl.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                        active ? 'ring-2 ring-offset-1' : 'opacity-50'
                      }`}
                      style={{ borderColor: lbl.color ?? '#6b7280', color: lbl.color ?? '#6b7280', backgroundColor: active ? `${lbl.color ?? '#6b7280'}18` : 'transparent' }}
                    >
                      {lbl.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.notes')}</FormLabel>
            <Textarea rows={2} placeholder={t('transactions.notesPlaceholder')} {...register('notes')} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? t('common.update') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Service dialog (add + edit) ──────────────────────────────────────────────

function ServiceDialog({
  open,
  vehicleId,
  vehicleName,
  editing,
  onClose,
}: {
  open: boolean
  vehicleId: string
  vehicleName: string
  editing?: VehicleService
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { addService, updateService } = useVehiclesStore()
  const { add: addTransaction } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  useEffect(() => { loadLabels() }, [loadLabels])

  const [customServiceType, setCustomServiceType] = useState(false)
  const defaultAccount = visibleAccounts[0] ?? accounts[0]
  const maintenanceCategory = categories.find((c) => c.id === 'vehicle-maintenance') ?? categories[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleServiceFormValues>({
    resolver: zodResolver(vehicleServiceSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      serviceType: '',
      cost: '',
      odometer: '',
      accountId: defaultAccount?.id ?? '',
      categoryId: maintenanceCategory?.id ?? '',
      status: 'cleared',
      notes: '',
      labels: [],
    },
  })

  const watchAccountId = watch('accountId')
  const watchCategoryId = watch('categoryId')
  const watchStatus = watch('status')
  const watchLabels = watch('labels') ?? []
  const watchServiceType = watch('serviceType')
  const availableAccounts = useMemo(
    () => getAccountSelectOptions(accounts, [watchAccountId]),
    [accounts, watchAccountId],
  )

  useEffect(() => {
    if (!open) return
    if (editing) {
      const existingTx = editing.transactionId
        ? useTransactionsStore.getState().transactions.find((tx) => tx.id === editing.transactionId)
        : undefined
      const isCustom = !SERVICE_TYPES.includes(editing.serviceType as typeof SERVICE_TYPES[number])
      setCustomServiceType(isCustom)
      reset({
        date: format(new Date(editing.date), 'yyyy-MM-dd'),
        time: format(new Date(editing.date), 'HH:mm'),
        serviceType: editing.serviceType,
        cost: (editing.cost / 100).toFixed(2),
        odometer: editing.odometer.toString(),
        notes: editing.notes ?? existingTx?.notes ?? '',
        nextServiceKm: editing.nextServiceKm?.toString() ?? '',
        nextServiceDate: editing.nextServiceDate
          ? format(new Date(editing.nextServiceDate), 'yyyy-MM-dd')
          : '',
        accountId: existingTx?.accountId ?? defaultAccount?.id ?? '',
        categoryId: existingTx?.categoryId ?? maintenanceCategory?.id ?? '',
        status: existingTx?.status ?? 'cleared',
        labels: existingTx?.labels ?? [],
      })
    } else {
      setCustomServiceType(false)
      reset({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        serviceType: '',
        cost: '',
        odometer: '',
        accountId: defaultAccount?.id ?? '',
        categoryId: maintenanceCategory?.id ?? '',
        status: 'cleared',
        notes: '',
        labels: [],
      })
    }
  }, [open, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLabel = (labelId: string) => {
    const current = watchLabels
    const next = current.includes(labelId) ? current.filter((l) => l !== labelId) : [...current, labelId]
    setValue('labels', next)
  }

  const onSubmit = async (values: VehicleServiceFormValues) => {
    const account = accounts.find((a) => a.id === values.accountId)
    const costCents = Math.round(parseFloat(values.cost) * 100)
    const [y, mo, d] = values.date.split('-').map(Number)
    const [hh, mm] = values.time.split(':').map(Number)
    const isoDate = new Date(y, mo - 1, d, hh, mm).toISOString()

    if (editing) {
      const updatedSvc: VehicleService = {
        ...editing,
        date: isoDate,
        serviceType: values.serviceType,
        cost: costCents,
        odometer: parseInt(values.odometer, 10),
        notes: values.notes || undefined,
        nextServiceKm: values.nextServiceKm ? parseInt(values.nextServiceKm, 10) : undefined,
        nextServiceDate: values.nextServiceDate
          ? new Date(values.nextServiceDate).toISOString()
          : undefined,
      }
      let linkedTx: Transaction | undefined
      if (editing.transactionId) {
        const existingTx = useTransactionsStore.getState().transactions.find(
          (tx) => tx.id === editing.transactionId,
        )
        if (existingTx) {
          linkedTx = {
            ...existingTx,
            amount: costCents,
            date: isoDate,
            categoryId: values.categoryId,
            accountId: values.accountId,
            description: `${values.serviceType} · ${vehicleName}`,
            notes: values.notes || undefined,
            status: values.status,
            labels: values.labels ?? [],
            currency: account?.currency ?? baseCurrency,
          }
        }
      }
      await updateService(updatedSvc, linkedTx)
    } else {
      const txId = uuid()
      const svcId = uuid()
      await addTransaction({
        id: txId,
        type: 'expense',
        amount: costCents,
        date: isoDate,
        categoryId: values.categoryId,
        accountId: values.accountId,
        description: `${values.serviceType} · ${vehicleName}`,
        notes: values.notes || undefined,
        status: values.status,
        currency: account?.currency ?? baseCurrency,
        labels: values.labels ?? [],
      })
      await addService({
        id: svcId,
        vehicleId,
        date: isoDate,
        serviceType: values.serviceType,
        cost: costCents,
        odometer: parseInt(values.odometer, 10),
        notes: values.notes || undefined,
        nextServiceKm: values.nextServiceKm ? parseInt(values.nextServiceKm, 10) : undefined,
        nextServiceDate: values.nextServiceDate
          ? new Date(values.nextServiceDate).toISOString()
          : undefined,
        transactionId: txId,
      })
    }
    reset()
    onClose()
  }

  const filteredCategories = categories.filter((c) => !c.deletedAt && (c.type === 'expense' || c.type === 'any'))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('vehicles.editService') : t('vehicles.addService')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>{t('transactions.date')}</FormLabel>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-red-500">{t(errors.date.message!)}</p>}
            </div>
            <div className="space-y-1">
              <FormLabel>{t('transactions.time')}</FormLabel>
              <Input type="time" {...register('time')} />
              {errors.time && <p className="text-xs text-red-500">{t(errors.time.message!)}</p>}
            </div>
          </div>

          {/* Service Type */}
          <div className="space-y-1">
            <FormLabel>{t('vehicles.serviceType')}</FormLabel>
            {customServiceType ? (
              <div className="flex gap-2">
                <Input className="flex-1" placeholder={t('vehicles.serviceTypePlaceholder')} {...register('serviceType')} />
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => { setCustomServiceType(false); setValue('serviceType', '') }}>
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <Select
                value={watchServiceType || ''}
                onValueChange={(v) => {
                  if (v === 'Other') { setCustomServiceType(true); setValue('serviceType', '') }
                  else setValue('serviceType', v as string)
                }}
              >
                <SelectTrigger>
                  <SelectValue>{watchServiceType || t('vehicles.selectServiceType')}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {SERVICE_TYPES.map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.serviceType && <p className="text-xs text-red-500">{t(errors.serviceType.message!)}</p>}
          </div>

          {/* Cost + Odometer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>{t('vehicles.cost')}</FormLabel>
              <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00" {...register('cost')} />
              {errors.cost && <p className="text-xs text-red-500">{t(errors.cost.message!)}</p>}
            </div>
            <div className="space-y-1">
              <FormLabel>{t('vehicles.odometer')}</FormLabel>
              <Input type="number" inputMode="numeric" placeholder="0" {...register('odometer')} />
              {errors.odometer && <p className="text-xs text-red-500">{t(errors.odometer.message!)}</p>}
            </div>
          </div>

          {/* Account */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.account')}</FormLabel>
            <Select value={watchAccountId || ''} onValueChange={(v) => setValue('accountId', v as string)}>
              <SelectTrigger><SelectValue>{accounts.find((a) => a.id === watchAccountId)?.name ?? t('transactions.selectAccount')}</SelectValue></SelectTrigger>
              <SelectContent>
                {availableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountId && <p className="text-xs text-red-500">{t(errors.accountId.message!)}</p>}
          </div>

          {/* Category */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.category')}</FormLabel>
            <Select value={watchCategoryId || ''} onValueChange={(v) => setValue('categoryId', v as string)}>
              <SelectTrigger><SelectValue>{filteredCategories.find((c) => c.id === watchCategoryId)?.name ?? t('transactions.selectCategory')}</SelectValue></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-xs text-red-500">{t(errors.categoryId.message!)}</p>}
          </div>

          {/* Status */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.statusLabel')}</FormLabel>
            <Select value={watchStatus} onValueChange={(v) => setValue('status', v as VehicleServiceFormValues['status'])}>
              <SelectTrigger><SelectValue>{t(`transactions.status.${watchStatus}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {(['cleared', 'pending', 'reconciled', 'cancelled'] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`transactions.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="space-y-1">
              <FormLabel>{t('transactions.labels')}</FormLabel>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((lbl) => {
                  const active = watchLabels.includes(lbl.id)
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabel(lbl.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                        active ? 'ring-2 ring-offset-1' : 'opacity-50'
                      }`}
                      style={{ borderColor: lbl.color ?? '#6b7280', color: lbl.color ?? '#6b7280', backgroundColor: active ? `${lbl.color ?? '#6b7280'}18` : 'transparent' }}
                    >
                      {lbl.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.notes')}</FormLabel>
            <Textarea rows={2} placeholder={t('transactions.notesPlaceholder')} {...register('notes')} />
          </div>

          {/* Next service */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>{t('vehicles.nextServiceKm')}</FormLabel>
              <Input type="number" inputMode="numeric" placeholder={t('common.optional')} {...register('nextServiceKm')} />
            </div>
            <div className="space-y-1">
              <FormLabel>{t('vehicles.nextServiceDate')}</FormLabel>
              <Input type="date" {...register('nextServiceDate')} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting}>{editing ? t('common.update') : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
      .map(([name, value]) => ({ name, value: value / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [services])

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
  const [tab, setTab] = useState<Tab>('fuel')
  const [fuelDialog, setFuelDialog] = useState(false)
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null)
  const [serviceDialog, setServiceDialog] = useState(false)
  const [editingSvc, setEditingSvc] = useState<VehicleService | null>(null)

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
            <Button size="sm" onClick={() => setFuelDialog(true)} className="gap-1">
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
                          onClick={() => { setEditingLog(log); setFuelDialog(true) }}>
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
          <FuelLogDialog
            open={fuelDialog}
            vehicleId={vehicle.id}
            vehicleName={vehicle.name}
            lastOdometer={logs[0]?.odometer ?? vehicle.initialOdometer ?? 0}
            editing={editingLog ?? undefined}
            onClose={() => { setFuelDialog(false); setEditingLog(null) }}
          />
        </>
      )}

      {/* Services tab */}
      {tab === 'service' && (
        <>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setServiceDialog(true)} className="gap-1">
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
                          <p className="text-sm font-medium truncate">{svc.serviceType}</p>
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
                          onClick={() => { setEditingSvc(svc); setServiceDialog(true) }}>
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
          <ServiceDialog
            open={serviceDialog}
            vehicleId={vehicle.id}
            vehicleName={vehicle.name}
            editing={editingSvc ?? undefined}
            onClose={() => { setServiceDialog(false); setEditingSvc(null) }}
          />
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
    </div>
  )
}
