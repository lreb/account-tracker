import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Plus, Pencil, Trash2, PiggyBank } from 'lucide-react'

import { budgetSchema, type BudgetFormValues } from '../schemas/budget.schema'
import { getVisibleAccountIds } from '@/lib/accounts'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useLabelsStore } from '@/stores/labels.store'
import { getBudgetUsage, type BudgetUsage } from '@/lib/budgets'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'
import type { Budget } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LabelPickerButton } from '@/components/ui/label-picker-button'
import { Label } from '@/components/ui/label'
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
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'

const DEFAULT_CATEGORY_NAME_TO_ID: Record<string, string> = {
  Transportation: 'transportation',
  'Food & Groceries': 'food-groceries',
  Health: 'health',
  Housing: 'housing',
  'Fuel / Gas': 'fuel-gas',
  Restaurants: 'restaurants',
  'Medical / Pharmacy': 'medical-pharmacy',
  'Rent / Mortgage': 'rent-mortgage',
  'Vehicle Maintenance': 'vehicle-maintenance',
  Supermarket: 'supermarket',
  'Health Insurance': 'health-insurance',
  Utilities: 'utilities',
  Entertainment: 'entertainment',
  Education: 'education',
  'Investments / Savings': 'investments-savings',
  Salary: 'salary',
  Freelance: 'freelance',
  Interest: 'interest',
  'Rental income': 'rental-income',
  Refund: 'refund',
  Other: 'other',
}

function getTranslatedCategoryName(
  t: (key: string, options?: { defaultValue?: string }) => string,
  category: { id: string; name: string },
): string {
  const keyById = `categories.names.${category.id}`
  const byId = t(keyById)
  if (byId !== keyById) {
    return byId
  }

  const mappedId = DEFAULT_CATEGORY_NAME_TO_ID[category.name]
  if (mappedId) {
    const keyByNameMap = `categories.names.${mappedId}`
    const byNameMap = t(keyByNameMap)
    if (byNameMap !== keyByNameMap) {
      return byNameMap
    }
  }

  return category.name
}

// ─── Budget progress bar ─────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(percent, 100)
  const color =
    percent >= 100 ? 'bg-red-500' : percent >= 75 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

// ─── Single budget card ───────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget
  onEdit: (b: Budget) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const { accounts } = useAccountsStore()
  const [usage, setUsage] = useState<BudgetUsage | null>(null)
  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])

  useEffect(() => {
    getBudgetUsage(budget, visibleAccountIds).then(setUsage).catch(console.error)
  }, [budget, visibleAccountIds])

  const category = categories.find((c) => c.id === budget.categoryId)
  const categoryLabel = category
    ? getTranslatedCategoryName(t, category)
    : budget.categoryId
  const percent = usage?.percent ?? 0
  const statusColor =
    percent >= 100 ? 'text-red-500' : percent >= 75 ? 'text-amber-500' : 'text-emerald-600'

  return (
    <div className="rounded-2xl border bg-white px-4 pt-3 pb-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 shrink-0">
          <CategoryIcon name={category?.icon ?? 'MoreHorizontal'} size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{categoryLabel}</p>
          <p className="text-xs text-gray-400 capitalize">{t(`budgets.periods.${budget.period}`)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(budget)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            onClick={() => onDelete(budget.id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar percent={percent} />

      {/* Amounts */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${statusColor}`}>
          {usage ? formatCurrency(usage.spent, baseCurrency) : '—'} {t('budgets.spent')}
        </span>
        <span className="text-gray-400">
          {t('budgets.of')} {formatCurrency(budget.amount, baseCurrency)}
          {budget.rollover && (
            <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">
              {t('budgets.rollover')}
            </Badge>
          )}
        </span>
        <span className={`font-bold ${statusColor}`}>{percent}%</span>
      </div>
    </div>
  )
}

// ─── Add / Edit dialog ────────────────────────────────────────────────────────

function BudgetDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Budget | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { add, update } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      period: 'monthly',
      rollover: false,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      categoryId: '',
      endDate: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        categoryId: editing.categoryId,
        amount: (editing.amount / 100).toFixed(2),
        period: editing.period,
        rollover: editing.rollover,
        startDate: editing.startDate.slice(0, 10),
        endDate: editing.endDate?.slice(0, 10) ?? '',
      })
    } else {
      reset({
        period: 'monthly',
        rollover: false,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        categoryId: '',
        endDate: '',
      })
    }
  }, [open, editing])

  const onSubmit = async (values: BudgetFormValues) => {
    const amountCents = Math.round(parseFloat(values.amount) * 100)
    const payload: Budget = {
      id: editing?.id ?? uuid(),
      categoryId: values.categoryId,
      amount: amountCents,
      period: values.period,
      rollover: values.rollover,
      startDate: new Date(values.startDate).toISOString(),
      endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
      currency: baseCurrency,
    }
    if (editing) {
      await update(payload)
    } else {
      await add(payload)
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? t('budgets.editBudget') : t('budgets.newBudget')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Category */}
          <div className="space-y-1">
            <Label>{t('budgets.category')}</Label>
            <Select
              value={watch('categoryId') || ''}
              onValueChange={(v) => setValue('categoryId', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('budgets.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {getTranslatedCategoryName(t, cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-xs text-red-500">{t(errors.categoryId.message!)}</p>
            )}
          </div>

          {/* Limit amount */}
          <div className="space-y-1">
            <Label htmlFor="bAmount">{t('budgets.limitWithCurrency', { currency: baseCurrency })}</Label>
            <Input
              id="bAmount"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('amount')}
            />
            {errors.amount && <p className="text-xs text-red-500">{t(errors.amount.message!)}</p>}
          </div>

          {/* Period */}
          <div className="space-y-1">
            <Label>{t('budgets.period')}</Label>
            <Select
              value={watch('period') || 'monthly'}
              onValueChange={(v) => setValue('period', v as BudgetFormValues['period'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{t('budgets.periods.weekly')}</SelectItem>
                <SelectItem value="monthly">{t('budgets.periods.monthly')}</SelectItem>
                <SelectItem value="yearly">{t('budgets.periods.yearly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start date */}
          <div className="space-y-1">
            <Label htmlFor="bStart">{t('budgets.startDate')}</Label>
            <Input id="bStart" type="date" {...register('startDate')} />
            {errors.startDate && (
              <p className="text-xs text-red-500">{t(errors.startDate.message!)}</p>
            )}
          </div>

          {/* End date (optional) */}
          <div className="space-y-1">
            <Label htmlFor="bEnd">{t('budgets.endDate')} <span className="text-gray-400">({t('common.optional')})</span></Label>
            <Input id="bEnd" type="date" {...register('endDate')} />
          </div>

          {/* Rollover toggle */}
          <div className="flex items-center gap-3">
            <Controller
              name="rollover"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    field.value ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      field.value ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              )}
            />
            <Label className="cursor-pointer">{t('budgets.rolloverLabel')}</Label>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { t } = useTranslation()
  const { budgets, remove } = useBudgetsStore()
  const { transactions } = useTransactionsStore()
  const { labels } = useLabelsStore()
  const { accounts } = useAccountsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([])

  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])

  const filteredBudgets = useMemo(() => {
    if (filterLabelIds.length === 0) return budgets
    return budgets.filter((b) =>
      transactions.some(
        (t) =>
          t.type === 'expense' &&
          visibleAccountIds.has(t.accountId) &&
          t.categoryId === b.categoryId &&
          filterLabelIds.some((id) => t.labels?.includes(id)),
      )
    )
  }, [budgets, transactions, filterLabelIds, visibleAccountIds])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (b: Budget) => { setEditing(b); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('budgets.title')}</h1>
        <div className="flex items-center gap-2">
          <LabelPickerButton labels={labels} selectedIds={filterLabelIds} onChange={setFilterLabelIds} />
          <Button size="sm" onClick={openAdd} className="gap-1">
            <Plus size={16} />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <PiggyBank size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">{t('budgets.noBudgets')}</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            {t('budgets.createFirstBudget')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredBudgets.map((budget) => (
            <li key={budget.id}>
              <BudgetCard budget={budget} onEdit={openEdit} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}

      <BudgetDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
      <ScrollToTopButton />
    </div>
  )
}
