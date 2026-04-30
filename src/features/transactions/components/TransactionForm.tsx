import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'

import { db } from '@/db'
import { getAccountSelectOptions, getVisibleAccounts } from '@/lib/accounts'
import { getAccountBalanceAtDate, isTransactionForAccount } from '@/lib/balance-sheet'
import { getTranslatedCategoryName } from '@/lib/categories'
import { transactionSchema, type TransactionFormValues } from '../schemas/transaction.schema'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTransactionCoreFields } from '@/hooks/useTransactionCoreFields'

import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LabelPickerButton } from '@/components/ui/label-picker-button'
import { StatusSelect } from '@/components/ui/status-select'
import { AccountSelect } from '@/components/ui/account-select'
import { CategorySelect } from '@/components/ui/category-select'
import { useVehiclesStore } from '@/stores/vehicles.store'
import type { FuelLog, VehicleService } from '@/types'
import VehicleLinkSection from './VehicleLinkSection'
import { VEHICLE_LINK_INITIAL_STATE } from './vehicle-link-section.types'
import type { VehicleLinkState } from './vehicle-link-section.types'
import CrossCurrencyDialog from './CrossCurrencyDialog'
import type { CrossCurrencyResult } from './CrossCurrencyDialog'
import { formatCurrency } from '@/lib/currency'

const TYPE_OPTIONS = [
  { value: 'expense',  label: 'transactions.expense' },
  { value: 'income',   label: 'transactions.income' },
  { value: 'transfer', label: 'transactions.transfer' },
] as const


export default function TransactionForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const accountContextId = searchParams.get('accountId')
  const returnTo = searchParams.get('returnTo')

  const { transactions, loading, load: loadTransactions, add, update } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const { load: loadRates } = useExchangeRatesStore()

  // ─── Cross-currency transfer state ────────────────────────────────────────
  const [crossCurrencyDialogOpen, setCrossCurrencyDialogOpen] = useState(false)
  const { baseCurrency, load: loadSettings } = useSettingsStore()
  const { addFuelLog, updateFuelLog, addService, updateService, load: loadVehicles } = useVehiclesStore()

  // Ensure the store is hydrated before we try to find the transaction.
  // On a hard refresh to /transactions/:id the store starts empty.
  const [storeReady, setStoreReady] = useState(!isEdit || transactions.length > 0)

  useEffect(() => {
    const tasks: Promise<void>[] = [loadLabels(), loadRates(), loadSettings(), loadVehicles()]
    if (isEdit && transactions.length === 0) {
      tasks.push(loadTransactions().then(() => setStoreReady(true)))
    }
    Promise.all(tasks)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const existing = isEdit ? transactions.find((tx) => tx.id === id) : undefined
  const defaultAccount = accounts.find((account) => account.id === accountContextId) ?? getVisibleAccounts(accounts)[0] ?? accounts[0]

  const [crossCurrencyDestAmountCents, setCrossCurrencyDestAmountCents] = useState<number | null>(
    () => existing?.originalAmount ?? null,
  )

  // local label selection — ids of chosen labels
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    () => existing?.labels ?? []
  )

  // ─── Vehicle link state ────────────────────────────────────────────────────
  const [vehicleLink, setVehicleLink] = useState<VehicleLinkState>(VEHICLE_LINK_INITIAL_STATE)
  const [existingVehicleLink, setExistingVehicleLink] = useState<{
    type: 'fuel' | 'service'
    id: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: existing
      ? {
          type:         existing.type,
          amount:       (existing.amount / 100).toFixed(2),
          date:         format(new Date(existing.date), 'yyyy-MM-dd'),
          time:         format(new Date(existing.date), 'HH:mm'),
          categoryId:   existing.categoryId,
          accountId:    existing.accountId,
          toAccountId:  existing.toAccountId ?? '',
          description:  existing.description,
          notes:        existing.notes ?? '',
          status:       existing.status,
          currency:     existing.currency,
          exchangeRate: existing.exchangeRate?.toString() ?? '',
        }
      : {
          type:       'expense',
          date:       format(new Date(), 'yyyy-MM-dd'),
          time:       format(new Date(), 'HH:mm'),
          status:     'cleared',
          currency:   defaultAccount?.currency ?? baseCurrency,
          amount:     '',
          categoryId: '',
          accountId:  defaultAccount?.id ?? '',
          description: '',
        },
  })

  useEffect(() => {
    if (isEdit || !accountContextId) {
      return
    }

    const contextAccount = accounts.find((account) => account.id === accountContextId)
    if (!contextAccount) {
      return
    }

    setValue('accountId', contextAccount.id)
    setValue('currency', contextAccount.currency)
  }, [isEdit, accountContextId, accounts, setValue])

  // When the store finishes loading on a hard-refresh edit, populate the form
  useEffect(() => {
    if (!storeReady || !isEdit || !existing) return
    reset({
      type:         existing.type,
      amount:       (existing.amount / 100).toFixed(2),
      date:         format(new Date(existing.date), 'yyyy-MM-dd'),
      time:         format(new Date(existing.date), 'HH:mm'),
      categoryId:   existing.categoryId,
      accountId:    existing.accountId,
      toAccountId:  existing.toAccountId ?? '',
      description:  existing.description,
      notes:        existing.notes ?? '',
      status:       existing.status,
      currency:     existing.currency,
      exchangeRate: existing.exchangeRate?.toString() ?? '',
    })
    setSelectedLabels(existing.labels ?? [])
  }, [storeReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect any existing vehicle link when editing a transaction
  useEffect(() => {
    if (!isEdit || !id) return
    async function detectLink() {
      const [allFuel, allServices] = await Promise.all([
        db.fuelLogs.toArray(),
        db.vehicleServices.toArray(),
      ])
      const linked = allFuel.find((l) => l.transactionId === id)
      const linkedSvc = allServices.find((s) => s.transactionId === id)
      if (linked) {
        setExistingVehicleLink({ type: 'fuel', id: linked.id })
        setVehicleLink({
          enabled: true,
          vehicleId: linked.vehicleId,
          linkType: 'fuel',
          odometer: linked.odometer.toString(),
          liters: linked.liters.toString(),
          serviceType: '',
          nextServiceKm: '',
          nextServiceDate: '',
        })
      } else if (linkedSvc) {
        setExistingVehicleLink({ type: 'service', id: linkedSvc.id })
        setVehicleLink({
          enabled: true,
          vehicleId: linkedSvc.vehicleId,
          linkType: 'service',
          odometer: linkedSvc.odometer.toString(),
          liters: '',
          serviceType: linkedSvc.serviceType,
          nextServiceKm: linkedSvc.nextServiceKm?.toString() ?? '',
          nextServiceDate: linkedSvc.nextServiceDate
            ? format(new Date(linkedSvc.nextServiceDate), 'yyyy-MM-dd')
            : '',
        })
      }
    }
    detectLink()
  }, [storeReady, isEdit, id])

  // Current balance per account: openingBalance + income − expense ± transfers
  // Queried directly from Dexie (all-time) so the result is always correct,
  // regardless of the date-filtered slice the list page keeps in the store.
  const [accountBalances, setAccountBalances] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>()
    for (const acct of accounts) map.set(acct.id, acct.openingBalance)
    return map
  })

  useEffect(() => {
    let stale = false
    async function computeBalances() {
      const activeTx = await db.transactions
        .filter((tx) => tx.status !== 'cancelled')
        .toArray()
      if (stale) return
      const map = new Map<string, number>()
      for (const acct of accounts) {
        const acctTxs = activeTx.filter((tx) => isTransactionForAccount(tx, acct.id))
        map.set(acct.id, getAccountBalanceAtDate(acct, acctTxs, new Date()))
      }
      setAccountBalances(map)
    }
    computeBalances()
    return () => { stale = true }
  }, [accounts])

  // Description auto-suggest: deduplicated map of description → most recent tx
  const suggestionMap = useMemo(() => {
    const map = new Map<string, typeof transactions[0]>()
    for (const tx of transactions) {
      const key = tx.description.toLowerCase()
      const prev = map.get(key)
      if (!prev || tx.date > prev.date) map.set(key, tx)
    }
    return map
  }, [transactions])

  const watchDescription = watch('description')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLUListElement>(null)
  const descriptionRef = useRef<HTMLInputElement | null>(null)

  const suggestions = useMemo(() => {
    const q = (watchDescription ?? '').trim().toLowerCase()
    if (q.length < 2 || isEdit) return []
    const results: { description: string; tx: typeof transactions[0] }[] = []
    for (const [key, tx] of suggestionMap) {
      if (key.includes(q)) results.push({ description: tx.description, tx })
      if (results.length >= 5) break
    }
    return results
  }, [watchDescription, suggestionMap, isEdit])

  const applySuggestion = (tx: typeof transactions[0]) => {
    setValue('description', tx.description)
    setValue('type', tx.type)
    setValue('amount', (tx.amount / 100).toFixed(2))
    setValue('categoryId', tx.categoryId)
    setValue('accountId', tx.accountId)
    setValue('toAccountId', tx.toAccountId ?? '')
    setValue('status', tx.status)
    setValue('notes', tx.notes ?? '')
    setSelectedLabels(tx.labels ?? [])
    setShowSuggestions(false)
  }

  // Close suggestions on outside click
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

  const watchType        = watch('type')
  const watchAccountId   = watch('accountId')
  const watchToAccountId = watch('toAccountId')
  const watchCategoryId  = watch('categoryId')
  const watchStatus      = watch('status')
  const watchCurrency    = watch('currency')
  const watchRate        = watch('exchangeRate')
  const watchAmount      = watch('amount')

  const {
    categories,
    sourceAccount,
    destAccount,
    isCrossCurrencyTransfer,
    filteredCategories,
  } = useTransactionCoreFields({
    watchType,
    watchAccountId,
    watchToAccountId,
    watchCurrency,
    setValue,
    existingCategoryId: existing?.categoryId,
    isEdit,
  })

  // Reset dest amount when accounts change and currencies no longer differ
  useEffect(() => {
    if (!isCrossCurrencyTransfer) {
      setCrossCurrencyDestAmountCents(null)
    }
  }, [isCrossCurrencyTransfer])

  // Auto-select vehicle link type when category matches fuel-gas or vehicle-maintenance
  useEffect(() => {
    if (watchType !== 'expense') return
    if (watchCategoryId === 'fuel-gas') {
      setVehicleLink((prev) => ({ ...prev, linkType: 'fuel' }))
    } else if (watchCategoryId === 'vehicle-maintenance') {
      setVehicleLink((prev) => ({ ...prev, linkType: 'service' }))
    }
  }, [watchCategoryId, watchType])

  const sourceAccountOptions = useMemo(() => {
    return getAccountSelectOptions(accounts, [watchAccountId, accountContextId ?? '', existing?.accountId ?? ''])
  }, [accounts, watchAccountId, accountContextId, existing])

  const destinationAccountOptions = useMemo(() => {
    return getAccountSelectOptions(accounts, [watchToAccountId ?? '', existing?.toAccountId ?? ''])
      .filter((account) => account.id !== watchAccountId)
  }, [accounts, watchAccountId, watchToAccountId, existing])

  const onSubmit = async (values: TransactionFormValues) => {
    const amountCents = Math.round(parseFloat(values.amount) * 100)
    const rateValue = values.exchangeRate ? parseFloat(values.exchangeRate) : undefined
    const isoDate = new Date(`${values.date}T${values.time}:00`).toISOString()
    const txId = isEdit && existing ? existing.id : uuid()

    // Cross-currency transfer: record destination amount and currency
    const toAcct = accounts.find((a) => a.id === values.toAccountId)
    const srcAcct = accounts.find((a) => a.id === values.accountId)
    const isCrossTransfer =
      values.type === 'transfer' &&
      !!toAcct && !!srcAcct &&
      toAcct.currency !== srcAcct.currency

    const originalAmount = isCrossTransfer
      ? (crossCurrencyDestAmountCents ?? (rateValue ? Math.round(amountCents * rateValue) : undefined))
      : undefined
    const originalCurrency = isCrossTransfer ? toAcct!.currency : undefined

    const base = {
      type:             values.type,
      amount:           amountCents,
      date:             isoDate,
      categoryId:       values.categoryId,
      accountId:        values.accountId,
      toAccountId:      values.toAccountId || undefined,
      description:      values.description,
      notes:            values.notes || undefined,
      status:           values.status,
      currency:         values.currency,
      exchangeRate:     rateValue,
      labels:           selectedLabels,
      originalAmount,
      originalCurrency,
    }

    if (isEdit && existing) {
      await update({ ...existing, ...base })
    } else {
      await add({ id: txId, ...base })
    }

    // Create or update linked vehicle record when type is expense
    if (vehicleLink.enabled && vehicleLink.vehicleId && values.type === 'expense') {
      const linkedRecordId = existingVehicleLink?.id ?? uuid()
      if (vehicleLink.linkType === 'fuel' && vehicleLink.liters) {
        const fuelPayload: FuelLog = {
          id: linkedRecordId,
          vehicleId: vehicleLink.vehicleId,
          date: isoDate,
          liters: parseFloat(vehicleLink.liters),
          totalCost: amountCents,
          odometer: parseInt(vehicleLink.odometer, 10) || 0,
          transactionId: txId,
        }
        if (existingVehicleLink?.type === 'fuel') {
          await updateFuelLog(fuelPayload)
        } else {
          await addFuelLog(fuelPayload)
        }
      } else if (vehicleLink.linkType === 'service' && vehicleLink.serviceType) {
        const svcPayload: VehicleService = {
          id: linkedRecordId,
          vehicleId: vehicleLink.vehicleId,
          date: isoDate,
          serviceType: vehicleLink.serviceType,
          cost: amountCents,
          odometer: parseInt(vehicleLink.odometer, 10) || 0,
          transactionId: txId,
          nextServiceKm: vehicleLink.nextServiceKm ? parseInt(vehicleLink.nextServiceKm, 10) : undefined,
          nextServiceDate: vehicleLink.nextServiceDate
            ? new Date(vehicleLink.nextServiceDate).toISOString()
            : undefined,
        }
        if (existingVehicleLink?.type === 'service') {
          await updateService(svcPayload)
        } else {
          await addService(svcPayload)
        }
      }
    }

    if (returnTo?.startsWith('/')) {
      navigate(returnTo)
      return
    }

    navigate('/transactions')
  }

  // Early returns after all hooks — guards for edit mode on hard refresh
  if (isEdit && (loading || !storeReady)) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{t('common.loading')}</p>
  }
  if (isEdit && !existing) {
    return <p className="text-sm text-red-500 py-10 text-center">{t('common.error')}</p>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5">

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">{t('common.description', 'Description')}</Label>
        <div className="relative">
          <Input
            id="description"
            placeholder="e.g. Grocery run"
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
                  onMouseDown={() => applySuggestion(tx)}
                >
                  <span className="truncate font-medium">{description}</span>
                  <span className="ml-2 text-xs text-muted-foreground shrink-0">
                    {getTranslatedCategoryName(categories.find((c) => c.id === tx.categoryId), t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {errors.description && <p className="text-xs text-red-500">{t(errors.description.message!)}</p>}
      </div>

      {/* Type tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {TYPE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setValue('type', value)}
            className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
              watchType === value
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {/* Amount */}
      <AmountInput
        label={t('common.amount', 'Amount')}
        value={watchAmount}
        currency={watchCurrency || baseCurrency}
        error={errors.amount ? t(errors.amount.message!) : undefined}
        onApply={(value) =>
          setValue('amount', value, { shouldDirty: true, shouldValidate: true, shouldTouch: true })
        }
        registerProps={register('amount')}
      />

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="date">{t('common.date', 'Date')}</Label>
          <Input id="date" type="date" {...register('date')} />
          {errors.date && <p className="text-xs text-red-500">{t(errors.date.message!)}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="time">{t('common.time', 'Time')}</Label>
          <Input id="time" type="time" {...register('time')} />
          {errors.time && <p className="text-xs text-red-500">{t(errors.time.message!)}</p>}
        </div>
      </div>

      {/* Category */}
      <CategorySelect
        value={watchCategoryId || ''}
        onChange={(v) => setValue('categoryId', v)}
        options={filteredCategories}
        error={errors.categoryId ? t(errors.categoryId.message!) : undefined}
      />

      {/* Account */}
      <AccountSelect
        value={watchAccountId || ''}
        onChange={(v) => setValue('accountId', v)}
        options={sourceAccountOptions}
        balances={accountBalances}
        label={t('settings.accounts')}
        error={errors.accountId ? t(errors.accountId.message!) : undefined}
      />

      {/* Destination account — transfers only */}
      {watchType === 'transfer' && (
        <AccountSelect
          value={watchToAccountId || ''}
          onChange={(v) => setValue('toAccountId', v || undefined)}
          options={destinationAccountOptions}
          balances={accountBalances}
          label={t('common.toAccount', 'To Account')}
          error={errors.toAccountId ? t(errors.toAccountId.message!) : undefined}
        />
      )}

      {/* Cross-currency exchange rate button — transfers with mismatched currencies */}
      {isCrossCurrencyTransfer && sourceAccount && destAccount && (
        <div className="space-y-1">
          <Label>{t('crossCurrency.sectionLabel')}</Label>
          <button
            type="button"
            onClick={() => setCrossCurrencyDialogOpen(true)}
            className="w-full flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-accent transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono bg-muted rounded px-1.5 py-0.5 text-xs">{sourceAccount.currency}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono bg-muted rounded px-1.5 py-0.5 text-xs">{destAccount.currency}</span>
            </span>
            {watchRate && parseFloat(watchRate) > 0 ? (
              <span className="text-right">
                <span className="font-medium tabular-nums">
                  1 {sourceAccount.currency} = {parseFloat(watchRate).toFixed(4)} {destAccount.currency}
                </span>
                {crossCurrencyDestAmountCents !== null && (
                  <span className="block text-xs text-muted-foreground">
                    ≈ {formatCurrency(crossCurrencyDestAmountCents, destAccount.currency)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground italic text-xs">{t('crossCurrency.notSet')}</span>
            )}
          </button>
          {!watchRate && (
            <p className="text-xs text-amber-600">{t('crossCurrency.requiredHint')}</p>
          )}

          <CrossCurrencyDialog
            open={crossCurrencyDialogOpen}
            onOpenChange={setCrossCurrencyDialogOpen}
            fromCurrency={sourceAccount.currency}
            toCurrency={destAccount.currency}
            sourceAmountCents={Math.round(parseFloat(watchAmount || '0') * 100)}
            initialRate={watchRate ? parseFloat(watchRate) : undefined}
            onConfirm={({ rate, destAmountCents }: CrossCurrencyResult) => {
              setValue('exchangeRate', rate.toFixed(6))
              setCrossCurrencyDestAmountCents(destAmountCents)
              setCrossCurrencyDialogOpen(false)
            }}
          />
        </div>
      )}

      {/* Status */}
      <StatusSelect value={watchStatus || 'cleared'} onChange={(v) => setValue('status', v)} />

      {/* Exchange rate — only when account currency differs from base currency (non-cross-currency-transfer) */}
      {!isCrossCurrencyTransfer && watchCurrency && watchCurrency !== baseCurrency && (
        <div className="space-y-1">
          <Label>{t('transactions.exchangeRate', 'Exchange Rate')}</Label>
          <Input
            type="number"
            step="0.000001"
            inputMode="decimal"
            placeholder="1.0000"
            {...register('exchangeRate')}
          />
          {watchRate && parseFloat(watchRate) > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('transactions.exchangeRateHelper', {
                currency: watchCurrency,
                rate: parseFloat(watchRate).toFixed(4),
                base: baseCurrency,
              })}
              {' '}
              <span className="text-xs opacity-60">({t('exchangeRates.autoFilled', 'Auto-filled from cache')})</span>
            </p>
          )}
          {errors.exchangeRate && (
            <p className="text-xs text-red-500">{t(errors.exchangeRate.message!)}</p>
          )}
        </div>
      )}

      {/* Labels */}
      <LabelPickerButton
        labels={labels}
        selectedIds={selectedLabels}
        onChange={setSelectedLabels}
      />

      {/* Vehicle link — expense only */}
      {watchType === 'expense' && (
        <VehicleLinkSection vehicleLink={vehicleLink} onChange={setVehicleLink} />
      )}

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">{t('common.notes', 'Notes')}</Label>
        <Textarea id="notes" rows={2} placeholder="Optional notes…" {...register('notes')} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (returnTo?.startsWith('/')) {
              navigate(returnTo)
              return
            }

            navigate(-1)
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
