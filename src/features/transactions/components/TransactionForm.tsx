import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'

import { getAccountSelectOptions, getVisibleAccounts } from '@/lib/accounts'
import { getTranslatedCategoryName } from '@/lib/categories'
import { transactionSchema, type TransactionFormValues } from '../schemas/transaction.schema'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { useSettingsStore } from '@/stores/settings.store'

import { Button } from '@/components/ui/button'
import { AmountCalculatorButton } from '@/components/ui/amount-calculator-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LabelPickerButton } from '@/components/ui/label-picker-button'
import { StatusSelect } from '@/components/ui/status-select'
import { AccountSelect } from '@/components/ui/account-select'

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
  const { categories } = useCategoriesStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const { getRateForPair, load: loadRates } = useExchangeRatesStore()
  const { baseCurrency, load: loadSettings } = useSettingsStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  // Ensure the store is hydrated before we try to find the transaction.
  // On a hard refresh to /transactions/:id the store starts empty.
  const [storeReady, setStoreReady] = useState(!isEdit || transactions.length > 0)

  useEffect(() => {
    const tasks: Promise<void>[] = [loadLabels(), loadRates(), loadSettings()]
    if (isEdit && transactions.length === 0) {
      tasks.push(loadTransactions().then(() => setStoreReady(true)))
    }
    Promise.all(tasks)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const existing = isEdit ? transactions.find((tx) => tx.id === id) : undefined
  const defaultAccount = accounts.find((account) => account.id === accountContextId) ?? visibleAccounts[0] ?? accounts[0]

  // local label selection — ids of chosen labels
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    () => existing?.labels ?? []
  )

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

  // Current balance per account: openingBalance + income − expense ± transfers
  const accountBalances = useMemo(() => {
    const map = new Map<string, number>()
    for (const acct of accounts) {
      map.set(acct.id, acct.openingBalance)
    }
    for (const tx of transactions) {
      if (tx.type === 'income') {
        map.set(tx.accountId, (map.get(tx.accountId) ?? 0) + tx.amount)
      } else if (tx.type === 'expense') {
        map.set(tx.accountId, (map.get(tx.accountId) ?? 0) - tx.amount)
      } else if (tx.type === 'transfer') {
        map.set(tx.accountId, (map.get(tx.accountId) ?? 0) - tx.amount)
        if (tx.toAccountId) {
          map.set(tx.toAccountId, (map.get(tx.toAccountId) ?? 0) + tx.amount)
        }
      }
    }
    return map
  }, [accounts, transactions])

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

  const sourceAccountOptions = useMemo(() => {
    return getAccountSelectOptions(accounts, [watchAccountId, accountContextId ?? '', existing?.accountId ?? ''])
  }, [accounts, watchAccountId, accountContextId, existing])

  const destinationAccountOptions = useMemo(() => {
    return getAccountSelectOptions(accounts, [watchToAccountId ?? '', existing?.toAccountId ?? ''])
      .filter((account) => account.id !== watchAccountId)
  }, [accounts, watchAccountId, watchToAccountId, existing])

  // Filter categories by selected transaction type and exclude soft-deleted
  const filteredCategories = useMemo(() => {
    const active = categories.filter((c) => {
      if (c.deletedAt) return false
      if (watchType === 'transfer') return true
      return c.type === watchType || c.type === 'any'
    })
    // Keep the currently-assigned category visible even if deleted/mismatched
    if (isEdit && existing && !active.find((c) => c.id === existing.categoryId)) {
      const assigned = categories.find((c) => c.id === existing.categoryId)
      if (assigned) active.unshift(assigned)
    }
    return active
  }, [categories, watchType, isEdit, existing])

  // Keep currency in sync with selected account
  useEffect(() => {
    const acct = accounts.find((a) => a.id === watchAccountId)
    if (acct) setValue('currency', acct.currency)
  }, [watchAccountId, accounts, setValue])

  // Auto-fill exchange rate when currency differs from base
  useEffect(() => {
    if (!watchCurrency || watchCurrency === baseCurrency) {
      setValue('exchangeRate', '')
      return
    }
    const cached = getRateForPair(watchCurrency, baseCurrency)
    if (cached !== null) setValue('exchangeRate', cached.toFixed(6))
  }, [watchCurrency, baseCurrency, getRateForPair, setValue])

  const onSubmit = async (values: TransactionFormValues) => {
    const amountCents = Math.round(parseFloat(values.amount) * 100)
    const rateValue = values.exchangeRate ? parseFloat(values.exchangeRate) : undefined
    const base = {
      type:         values.type,
      amount:       amountCents,
      date:         new Date(`${values.date}T${values.time}:00`).toISOString(),
      categoryId:   values.categoryId,
      accountId:    values.accountId,
      toAccountId:  values.toAccountId || undefined,
      description:  values.description,
      notes:        values.notes || undefined,
      status:       values.status,
      currency:     values.currency,
      exchangeRate: rateValue,
      labels:       selectedLabels,
    }

    if (isEdit && existing) {
      await update({ ...existing, ...base })
    } else {
      await add({ id: uuid(), ...base })
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
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="amount">{t('common.amount', 'Amount')}</Label>
          <AmountCalculatorButton
            currentValue={watch('amount')}
            onApply={(value) => {
              setValue('amount', value, {
                shouldDirty: true,
                shouldValidate: true,
                shouldTouch: true,
              })
            }}
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
      <div className="space-y-1">
        <Label>{t('settings.categories')}</Label>
        <Select
          value={watchCategoryId || undefined}
          onValueChange={(v) => setValue('categoryId', v ?? '')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category">
              {getTranslatedCategoryName(categories.find((c) => c.id === watchCategoryId), t)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {getTranslatedCategoryName(cat, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && <p className="text-xs text-red-500">{t(errors.categoryId.message!)}</p>}
      </div>

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

      {/* Status */}
      <StatusSelect value={watchStatus || 'cleared'} onChange={(v) => setValue('status', v)} />

      {/* Exchange rate — only when account currency differs from base currency */}
      {watchCurrency && watchCurrency !== baseCurrency && (
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
