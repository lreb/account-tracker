import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'

import { transactionSchema, type TransactionFormValues } from '../schemas/transaction.schema'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'

import { Button } from '@/components/ui/button'
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

const TYPE_OPTIONS = [
  { value: 'expense',  label: 'transactions.expense' },
  { value: 'income',   label: 'transactions.income' },
  { value: 'transfer', label: 'transactions.transfer' },
] as const

const STATUS_OPTIONS = [
  { value: 'cleared',     label: 'transactions.status.cleared' },
  { value: 'pending',     label: 'transactions.status.pending' },
  { value: 'reconciled',  label: 'transactions.status.reconciled' },
  { value: 'cancelled',   label: 'transactions.status.cancelled' },
] as const

export default function TransactionForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)

  const { transactions, add, update } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()

  const existing = isEdit ? transactions.find((tx) => tx.id === id) : undefined

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: existing
      ? {
          type:         existing.type,
          amount:       (existing.amount / 100).toFixed(2),
          date:         existing.date.slice(0, 10),
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
          status:     'cleared',
          currency:   accounts[0]?.currency ?? 'USD',
          amount:     '',
          categoryId: '',
          accountId:  accounts[0]?.id ?? '',
          description: '',
        },
  })

  const watchType = watch('type')
  const watchAccountId = watch('accountId')

  // Keep currency in sync with selected account
  useEffect(() => {
    const acct = accounts.find((a) => a.id === watchAccountId)
    if (acct) setValue('currency', acct.currency)
  }, [watchAccountId, accounts, setValue])

  const onSubmit = async (values: TransactionFormValues) => {
    const amountCents = Math.round(parseFloat(values.amount) * 100)
    const base = {
      type:        values.type,
      amount:      amountCents,
      date:        new Date(values.date).toISOString(),
      categoryId:  values.categoryId,
      accountId:   values.accountId,
      description: values.description,
      notes:       values.notes || undefined,
      status:      values.status,
      currency:    values.currency,
      labels:      existing?.labels ?? [],
    }

    if (isEdit && existing) {
      await update({ ...existing, ...base })
    } else {
      await add({ id: uuid(), ...base })
    }
    navigate('/transactions')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5">

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
        <Label htmlFor="amount">{t('common.amount', 'Amount')}</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          {...register('amount')}
        />
        {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="date">{t('common.date', 'Date')}</Label>
        <Input id="date" type="date" {...register('date')} />
        {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">{t('common.description', 'Description')}</Label>
        <Input id="description" placeholder="e.g. Grocery run" {...register('description')} />
        {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
      </div>

      {/* Category */}
      <div className="space-y-1">
        <Label>{t('settings.categories')}</Label>
        <Select
          defaultValue={existing?.categoryId}
          onValueChange={(v) => setValue('categoryId', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
      </div>

      {/* Account */}
      <div className="space-y-1">
        <Label>{t('settings.accounts')}</Label>
        <Select
          defaultValue={existing?.accountId ?? accounts[0]?.id}
          onValueChange={(v) => setValue('accountId', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acct) => (
              <SelectItem key={acct.id} value={acct.id}>
                {acct.name} ({acct.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.accountId && <p className="text-xs text-red-500">{errors.accountId.message}</p>}
      </div>

      {/* Destination account — transfers only */}
      {watchType === 'transfer' && (
        <div className="space-y-1">
          <Label>{t('common.toAccount', 'To Account')}</Label>
          <Select
            defaultValue={existing?.toAccountId}
            onValueChange={(v) => setValue('toAccountId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select destination account" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((a) => a.id !== watchAccountId)
                .map((acct) => (
                  <SelectItem key={acct.id} value={acct.id}>
                    {acct.name} ({acct.currency})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {errors.toAccountId && <p className="text-xs text-red-500">{errors.toAccountId.message}</p>}
        </div>
      )}

      {/* Status */}
      <div className="space-y-1">
        <Label>{t('common.status', 'Status')}</Label>
        <Select
          defaultValue={existing?.status ?? 'cleared'}
          onValueChange={(v) => setValue('status', v as TransactionFormValues['status'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {t(label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">{t('common.notes', 'Notes')}</Label>
        <Textarea id="notes" rows={2} placeholder="Optional notes…" {...register('notes')} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
