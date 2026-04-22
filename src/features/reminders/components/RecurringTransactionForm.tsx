import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'

import { getAccountSelectOptions, getVisibleAccounts } from '@/lib/accounts'
import { advanceDueDate } from '@/lib/recurring-transactions'
import {
  recurringTransactionSchema,
  type RecurringTransactionFormValues,
} from '../schemas/recurring-transaction.schema'
import { useRecurringTransactionsStore } from '@/stores/recurring-transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTransactionCoreFields } from '@/hooks/useTransactionCoreFields'

import { Button } from '@/components/ui/button'
import { AmountCalculatorButton } from '@/components/ui/amount-calculator-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LabelPickerButton } from '@/components/ui/label-picker-button'
import { StatusSelect } from '@/components/ui/status-select'
import { AccountSelect } from '@/components/ui/account-select'
import { CategorySelect } from '@/components/ui/category-select'

import type { RecurringInterval } from '@/types'

const TYPE_OPTIONS = [
  { value: 'expense',  label: 'transactions.expense' },
  { value: 'income',   label: 'transactions.income' },
  { value: 'transfer', label: 'transactions.transfer' },
] as const

const INTERVAL_OPTIONS: { value: RecurringInterval; labelKey: string }[] = [
  { value: 'daily',    labelKey: 'reminders.intervals.daily' },
  { value: 'weekly',   labelKey: 'reminders.intervals.weekly' },
  { value: 'biweekly', labelKey: 'reminders.intervals.biweekly' },
  { value: 'monthly',  labelKey: 'reminders.intervals.monthly' },
  { value: 'yearly',   labelKey: 'reminders.intervals.yearly' },
]

export default function RecurringTransactionForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const returnTo = searchParams.get('returnTo')

  const { recurringTransactions, loading, load, add, update } = useRecurringTransactionsStore()
  const { accounts } = useAccountsStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const { load: loadRates } = useExchangeRatesStore()
  const { baseCurrency, load: loadSettings } = useSettingsStore()

  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  const [storeReady, setStoreReady] = useState(!isEdit || recurringTransactions.length > 0)

  useEffect(() => {
    const tasks: Promise<void>[] = [loadLabels(), loadRates(), loadSettings()]
    if (isEdit && recurringTransactions.length === 0) {
      tasks.push(load().then(() => setStoreReady(true)))
    }
    Promise.all(tasks)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const existing = isEdit ? recurringTransactions.find((r) => r.id === id) : undefined
  const defaultAccount = visibleAccounts[0] ?? accounts[0]

  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    () => existing?.labels ?? [],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: existing
      ? {
          type:             existing.type,
          amount:           (existing.amount / 100).toFixed(2),
          categoryId:       existing.categoryId,
          accountId:        existing.accountId,
          toAccountId:      existing.toAccountId ?? '',
          description:      existing.description,
          notes:            existing.notes ?? '',
          status:           existing.status,
          currency:         existing.currency,
          exchangeRate:     existing.exchangeRate?.toString() ?? '',
          interval:         existing.interval,
          startDate:        existing.startDate,
          time:             existing.time,
          totalOccurrences: existing.totalOccurrences.toString(),
        }
      : {
          type:             'expense',
          startDate:        format(new Date(), 'yyyy-MM-dd'),
          time:             '09:00',
          status:           'pending',
          currency:         defaultAccount?.currency ?? baseCurrency,
          amount:           '',
          categoryId:       '',
          accountId:        defaultAccount?.id ?? '',
          interval:         'monthly',
          totalOccurrences: '12',
          description:      '',
        },
  })

  // When store finishes loading on hard-refresh edit, populate the form
  useEffect(() => {
    if (!storeReady || !isEdit || !existing) return
    reset({
      type:             existing.type,
      amount:           (existing.amount / 100).toFixed(2),
      categoryId:       existing.categoryId,
      accountId:        existing.accountId,
      toAccountId:      existing.toAccountId ?? '',
      description:      existing.description,
      notes:            existing.notes ?? '',
      status:           existing.status,
      currency:         existing.currency,
      exchangeRate:     existing.exchangeRate?.toString() ?? '',
      interval:         existing.interval,
      startDate:        existing.startDate,
      time:             existing.time,
      totalOccurrences: existing.totalOccurrences.toString(),
    })
    setSelectedLabels(existing.labels ?? [])
  }, [storeReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const watchType        = watch('type')
  const watchAccountId   = watch('accountId')
  const watchToAccountId = watch('toAccountId')
  const watchCurrency    = watch('currency')
  const watchRate        = watch('exchangeRate')
  const watchAmount      = watch('amount')
  const watchInterval    = watch('interval')
  const watchStatus      = watch('status')
  const watchCategoryId  = watch('categoryId')

  const {
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

  const sourceAccountOptions = useMemo(
    () => getAccountSelectOptions(accounts, [watchAccountId, existing?.accountId ?? '']),
    [accounts, watchAccountId, existing],
  )

  const destinationAccountOptions = useMemo(
    () =>
      getAccountSelectOptions(accounts, [watchToAccountId ?? '', existing?.toAccountId ?? ''])
        .filter((a) => a.id !== watchAccountId),
    [accounts, watchAccountId, watchToAccountId, existing],
  )

  const onSubmit = async (values: RecurringTransactionFormValues) => {
    const amountCents = Math.round(parseFloat(values.amount) * 100)
    const rateValue   = values.exchangeRate ? parseFloat(values.exchangeRate) : undefined
    const rid         = isEdit && existing ? existing.id : uuid()
    const interval    = values.interval as RecurringInterval

    const base = {
      type:             values.type,
      amount:           amountCents,
      categoryId:       values.categoryId,
      accountId:        values.accountId,
      toAccountId:      values.toAccountId || undefined,
      description:      values.description,
      notes:            values.notes || undefined,
      status:           values.status,
      currency:         values.currency,
      exchangeRate:     rateValue,
      labels:           selectedLabels,
      interval,
      startDate:        values.startDate,
      time:             values.time,
      totalOccurrences: parseInt(values.totalOccurrences, 10),
    }

    if (isEdit && existing) {
      await update({
        ...existing,
        ...base,
        // Recompute nextDueDate only if startDate changed and no occurrences fired yet
        nextDueDate:
          existing.occurrencesFired === 0
            ? values.startDate
            : existing.nextDueDate,
      })
    } else {
      await add({
        id:                rid,
        ...base,
        occurrencesFired:  0,
        nextDueDate:       values.startDate,
        createdAt:         new Date().toISOString(),
        active:            true,
      })
    }

    if (returnTo?.startsWith('/')) {
      navigate(returnTo)
      return
    }
    navigate('/reminders')
  }

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
        <Label htmlFor="description">{t('common.description')}</Label>
        <Input
          id="description"
          placeholder={t('reminders.descriptionPlaceholder')}
          autoComplete="off"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-red-500">{t(errors.description.message!)}</p>
        )}
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
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="amount">{t('common.amount')}</Label>
          <AmountCalculatorButton
            currentValue={watchAmount}
            onApply={(value) => setValue('amount', value, { shouldDirty: true, shouldValidate: true, shouldTouch: true })}
          />
        </div>
        <Input
          id="amount"
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          {...register('amount')}
        />
        {errors.amount && <p className="text-xs text-red-500">{t(errors.amount.message!)}</p>}
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
        label={t('settings.accounts')}
        error={errors.accountId ? t(errors.accountId.message!) : undefined}
      />

      {/* Destination account — transfers only */}
      {watchType === 'transfer' && (
        <AccountSelect
          value={watchToAccountId || ''}
          onChange={(v) => setValue('toAccountId', v || undefined)}
          options={destinationAccountOptions}
          label={t('common.toAccount')}
          error={errors.toAccountId ? t(errors.toAccountId.message!) : undefined}
        />
      )}

      {/* Cross-currency note (simplified — no dialog for recurring) */}
      {isCrossCurrencyTransfer && sourceAccount && destAccount && (
        <div className="space-y-1">
          <Label>{t('transactions.exchangeRate')}</Label>
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
                currency: sourceAccount.currency,
                rate: parseFloat(watchRate).toFixed(4),
                base: destAccount.currency,
              })}
            </p>
          )}
        </div>
      )}

      {/* Exchange rate — single-currency, non-base account */}
      {!isCrossCurrencyTransfer && watchCurrency && watchCurrency !== baseCurrency && (
        <div className="space-y-1">
          <Label>{t('transactions.exchangeRate')}</Label>
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
            </p>
          )}
          {errors.exchangeRate && (
            <p className="text-xs text-red-500">{t(errors.exchangeRate.message!)}</p>
          )}
        </div>
      )}

      {/* Status */}
      <StatusSelect value={watchStatus || 'pending'} onChange={(v) => setValue('status', v)} />

      {/* Labels */}
      <LabelPickerButton
        labels={labels}
        selectedIds={selectedLabels}
        onChange={setSelectedLabels}
      />

      {/* ─── Schedule section ─────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-800">{t('reminders.schedule')}</p>

        {/* Interval */}
        <div className="space-y-1">
          <Label>{t('reminders.interval')}</Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1">
            {INTERVAL_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('interval', value)}
                className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  watchInterval === value
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {errors.interval && (
            <p className="text-xs text-red-500">{t(errors.interval.message!)}</p>
          )}
        </div>

        {/* Start date & time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="startDate">{t('reminders.startDate')}</Label>
            <Input id="startDate" type="date" {...register('startDate')} />
            {errors.startDate && (
              <p className="text-xs text-red-500">{t(errors.startDate.message!)}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="time">{t('common.time')}</Label>
            <Input id="time" type="time" {...register('time')} />
            {errors.time && (
              <p className="text-xs text-red-500">{t(errors.time.message!)}</p>
            )}
          </div>
        </div>

        {/* Total occurrences */}
        <div className="space-y-1">
          <Label htmlFor="totalOccurrences">{t('reminders.totalOccurrences')}</Label>
          <Input
            id="totalOccurrences"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="12"
            {...register('totalOccurrences')}
          />
          <p className="text-xs text-muted-foreground">{t('reminders.totalOccurrencesHint')}</p>
          {errors.totalOccurrences && (
            <p className="text-xs text-red-500">{t(errors.totalOccurrences.message!)}</p>
          )}
        </div>

        {/* Preview */}
        {watch('startDate') && watch('interval') && watch('totalOccurrences') && (
          <p className="text-xs text-muted-foreground italic">
            {t('reminders.schedulePreview', {
              interval: t(`reminders.intervals.${watchInterval}`).toLowerCase(),
              count: parseInt(watch('totalOccurrences'), 10),
              startDate: watch('startDate'),
              nextDate: advanceDueDate(watch('startDate') || format(new Date(), 'yyyy-MM-dd'), watchInterval as RecurringInterval),
            })}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">{t('common.notes')}</Label>
        <Textarea id="notes" rows={2} placeholder={t('transactions.notesPlaceholder')} {...register('notes')} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (returnTo?.startsWith('/')) { navigate(returnTo); return }
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
