import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { ArrowLeft } from 'lucide-react'

import { fuelLogSchema, type FuelLogFormValues } from '../schemas/vehicle.schema'
import {
  getAccountSelectOptions,
  getVisibleAccounts,
} from '@/lib/accounts'
import { getTranslatedCategoryName } from '@/lib/categories'
import { getOdometerNeighbors, type OdometerEntry } from '@/lib/vehicles'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLabelsStore } from '@/stores/labels.store'
import type { FuelLog, Transaction } from '@/types'

import { Button } from '@/components/ui/button'
import { AmountCalculatorButton } from '@/components/ui/amount-calculator-button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LabelPickerButton } from '@/components/ui/label-picker-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function FuelLogFormPage() {
  const { t } = useTranslation()
  const { vehicleId, fuelId } = useParams<{ vehicleId: string; fuelId?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnToPath = searchParams.get('returnTo') ?? `/vehicles/${vehicleId}`

  const { vehicles, addFuelLog, updateFuelLog, fuelLogs, vehicleServices } = useVehiclesStore()
  const { add: addTransaction, transactions } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const { labels, load: loadLabels } = useLabelsStore()

  useEffect(() => { loadLabels() }, [loadLabels])

  const vehicle = vehicles.find((v) => v.id === vehicleId)
  const editing = fuelId ? fuelLogs.find((l) => l.id === fuelId) ?? null : null
  const isEditing = Boolean(fuelId)

  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])
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
      description: '',
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
  const watchDate = watch('date')
  const watchTime = watch('time')

  const availableAccounts = useMemo(
    () => getAccountSelectOptions(accounts, [watchAccountId]),
    [accounts, watchAccountId],
  )

  const odometerEntries = useMemo<OdometerEntry[]>(() => {
    const fromFuel = fuelLogs
      .filter((log) => log.vehicleId === vehicleId && log.id !== editing?.id)
      .map((log) => ({ date: log.date, odometer: log.odometer }))

    const fromServices = vehicleServices
      .filter((service) => service.vehicleId === vehicleId)
      .map((service) => ({ date: service.date, odometer: service.odometer }))

    return [...fromFuel, ...fromServices].sort((a, b) => a.date.localeCompare(b.date))
  }, [fuelLogs, vehicleServices, vehicleId, editing?.id])

  const selectedDateIso = useMemo(() => {
    if (!watchDate || !watchTime) return undefined
    const [y, m, d] = watchDate.split('-').map(Number)
    const [hh, mm] = watchTime.split(':').map(Number)
    if ([y, m, d, hh, mm].some(Number.isNaN)) return undefined
    return new Date(y, m - 1, d, hh, mm).toISOString()
  }, [watchDate, watchTime])

  const { previousOdometer, nextOdometer } = useMemo(
    () => getOdometerNeighbors(odometerEntries, selectedDateIso),
    [odometerEntries, selectedDateIso],
  )

  const odometerPlaceholder = useMemo(() => {
    const initialOdo = vehicle?.initialOdometer ?? 0
    if (odometerEntries.length === 0) {
      return initialOdo > 0 ? `${t('vehicles.last')}: ${initialOdo.toLocaleString()}` : '0'
    }
    if (previousOdometer != null && nextOdometer != null) {
      return `${t('vehicles.last')}: ${previousOdometer.toLocaleString()} · ${t('vehicles.nextAt')}: ${nextOdometer.toLocaleString()}`
    }
    if (previousOdometer != null) {
      return `${t('vehicles.last')}: ${previousOdometer.toLocaleString()}`
    }
    if (nextOdometer != null) {
      return `${t('vehicles.nextAt')}: ${nextOdometer.toLocaleString()}`
    }
    return '0'
  }, [odometerEntries.length, vehicle?.initialOdometer, previousOdometer, nextOdometer, t])

  // Auto-calc total cost ↔ cost/liter when liters change
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

  // Description auto-suggest from past fuel transactions
  const watchDescription = watch('description')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLUListElement>(null)
  const descriptionRef = useRef<HTMLInputElement | null>(null)

  const suggestionMap = useMemo(() => {
    const map = new Map<string, typeof transactions[0]>()
    for (const tx of transactions) {
      if (tx.categoryId !== fuelCategory?.id) continue
      const key = tx.description.toLowerCase()
      const prev = map.get(key)
      if (!prev || tx.date > prev.date) map.set(key, tx)
    }
    return map
  }, [transactions, fuelCategory?.id])

  const suggestions = useMemo(() => {
    const q = (watchDescription ?? '').trim().toLowerCase()
    if (q.length < 2 || isEditing) return []
    const results: { description: string; tx: typeof transactions[0] }[] = []
    for (const [key, tx] of suggestionMap) {
      if (key.includes(q)) results.push({ description: tx.description, tx })
      if (results.length >= 5) break
    }
    return results
  }, [watchDescription, suggestionMap, isEditing])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        descriptionRef.current && !descriptionRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (isEditing && editing) {
      const existingTx = editing.transactionId
        ? transactions.find((tx) => tx.id === editing.transactionId)
        : undefined
      const cpl = editing.liters > 0 ? ((editing.totalCost / 100) / editing.liters).toFixed(4) : ''
      reset({
        date: format(new Date(editing.date), 'yyyy-MM-dd'),
        time: format(new Date(editing.date), 'HH:mm'),
        description: existingTx?.description ?? '',
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
    }
  }, [isEditing, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: editing a fuel log that doesn't exist
  useEffect(() => {
    if (isEditing && fuelId && !editing) {
      navigate(returnToPath, { replace: true })
    }
  }, [editing, fuelId, isEditing, navigate, returnToPath])

  const onSubmit = async (values: FuelLogFormValues) => {
    if (!vehicleId || !vehicle) return
    const account = accounts.find((a) => a.id === values.accountId)
    const costCents = Math.round(parseFloat(values.totalCost) * 100)
    const [y, m, d] = values.date.split('-').map(Number)
    const [hh, mm] = values.time.split(':').map(Number)
    const isoDate = new Date(y, m - 1, d, hh, mm).toISOString()
    const autoDescription = `${t('vehicles.fuelFillUp')} – ${parseFloat(values.liters).toFixed(2)} L · ${vehicle.name}`
    const description = values.description?.trim() || autoDescription

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
        const existingTx = transactions.find((tx) => tx.id === editing.transactionId)
        if (existingTx) {
          linkedTx = {
            ...existingTx,
            amount: costCents,
            date: isoDate,
            categoryId: values.categoryId,
            accountId: values.accountId,
            description: description,
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
        description: description,
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

    navigate(returnToPath)
  }

  const filteredCategories = categories.filter((c) => !c.deletedAt && (c.type === 'expense' || c.type === 'any'))

  return (
    <div className="p-4 pb-24 max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(returnToPath)}
        >
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-xl font-bold">
          {isEditing ? t('vehicles.editFuelLog') : t('vehicles.addFuelLog')}
        </h1>
      </div>

      {vehicle && (
        <p className="text-sm text-gray-500 -mt-2 ml-10">{vehicle.name}</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border bg-white p-4">
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

        {/* Description */}
        <div className="space-y-1">
          <FormLabel>{t('common.description', 'Description')}</FormLabel>
          <div className="relative">
            <Input
              placeholder={t('vehicles.descriptionPlaceholder', 'e.g. Shell Station Hwy 101')}
              autoComplete="off"
              {...register('description')}
              ref={(el) => {
                register('description').ref(el)
                descriptionRef.current = el
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onChange={(e) => {
                register('description').onChange(e)
                setShowSuggestions(true)
              }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul
                ref={suggestionsRef}
                className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-48 overflow-y-auto"
              >
                {suggestions.map(({ description, tx }) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                    onMouseDown={() => {
                      setValue('description', description)
                      setShowSuggestions(false)
                    }}
                  >
                    <span className="truncate font-medium">{description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errors.description && <p className="text-xs text-red-500">{t(errors.description.message!)}</p>}
        </div>

        {/* Odometer */}
        <div className="space-y-1">
          <FormLabel>{t('vehicles.odometer')}</FormLabel>
          <Input type="number" inputMode="numeric" placeholder={odometerPlaceholder} {...register('odometer')} />
          {errors.odometer && <p className="text-xs text-red-500">{t(errors.odometer.message!)}</p>}
        </div>

        {/* Liters + Cost per liter */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FormLabel>{t('vehicles.liters')}</FormLabel>
            <Input
              type="number"
              step="0.001"
              inputMode="decimal"
              placeholder="40.000"
              {...register('liters')}
            />
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
          <div className="flex items-center justify-between gap-2">
            <FormLabel>{t('vehicles.totalCost')}</FormLabel>
            <AmountCalculatorButton
              currentValue={watchTotalCost}
              onApply={(value) => {
                setValue('totalCost', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                  shouldTouch: true,
                })
                setLastEdited('totalCost')
              }}
            />
          </div>
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
            <SelectTrigger>
              <SelectValue>{accounts.find((a) => a.id === watchAccountId)?.name ?? t('transactions.selectAccount')}</SelectValue>
            </SelectTrigger>
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
            <SelectTrigger>
              <SelectValue>{getTranslatedCategoryName(filteredCategories.find((c) => c.id === watchCategoryId), t) || t('transactions.selectCategory')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{getTranslatedCategoryName(c, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && <p className="text-xs text-red-500">{t(errors.categoryId.message!)}</p>}
        </div>

        {/* Status */}
        <div className="space-y-1">
          <FormLabel>{t('transactions.statusLabel')}</FormLabel>
          <Select value={watchStatus} onValueChange={(v) => setValue('status', v as FuelLogFormValues['status'])}>
            <SelectTrigger>
              <SelectValue>{t(`transactions.status.${watchStatus}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(['cleared', 'pending', 'reconciled', 'cancelled'] as const).map((s) => (
                <SelectItem key={s} value={s}>{t(`transactions.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Labels */}
        <LabelPickerButton
          labels={labels}
          selectedIds={watchLabels}
          onChange={(ids) => setValue('labels', ids)}
        />

        {/* Notes */}
        <div className="space-y-1">
          <FormLabel>{t('transactions.notes')}</FormLabel>
          <Textarea rows={2} placeholder={t('transactions.notesPlaceholder')} {...register('notes')} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(returnToPath)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isEditing ? t('common.update') : t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
