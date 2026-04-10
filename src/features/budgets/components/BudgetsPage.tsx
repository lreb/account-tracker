import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  isSameMonth,
  getYear,
  setYear,
  setMonth,
} from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Plus, Pencil, Trash2, PiggyBank, ChevronLeft, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react'

import { budgetSchema, type BudgetFormValues } from '../schemas/budget.schema'
import { getActiveAccountIds } from '@/lib/accounts'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getBudgetUsage, type BudgetUsage } from '@/lib/budgets'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'
import { getTranslatedCategoryName } from '@/lib/categories'
import type { Budget, Category } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

// ─── Month Picker Dialog ──────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function MonthPickerDialog({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean
  current: Date
  onSelect: (d: Date) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [year, setPickerYear] = useState(getYear(current))
  const today = new Date()
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('budgets.selectMonth')}</DialogTitle>
        </DialogHeader>

        {/* Year navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setPickerYear((y) => y - 1)}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold">{year}</span>
          <button
            type="button"
            onClick={() => setPickerYear((y) => y + 1)}
            className="rounded-full p-1.5 hover:bg-gray-100"
            disabled={year >= getYear(today)}
          >
            <ChevronRight size={16} className={year >= getYear(today) ? 'text-gray-300' : ''} />
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, idx) => {
            const candidate = startOfMonth(setMonth(setYear(new Date(), year), idx))
            const isSelected = isSameMonth(candidate, current)
            const isFuture = candidate > startOfMonth(today)
            return (
              <button
                key={name}
                type="button"
                disabled={isFuture}
                onClick={() => { onSelect(candidate); onClose() }}
                className={`rounded-xl py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isFuture
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { onSelect(startOfMonth(today)); onClose() }}
          >
            {t('budgets.today')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
  referenceDate,
  onEdit,
  onDelete,
}: {
  budget: Budget
  referenceDate: Date
  onEdit: (b: Budget) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const { accounts } = useAccountsStore()
  const [usage, setUsage] = useState<BudgetUsage | null>(null)
  const activeAccountIds = useMemo(() => getActiveAccountIds(accounts), [accounts])

  useEffect(() => {
    getBudgetUsage(budget, activeAccountIds, referenceDate).then(setUsage).catch(console.error)
  }, [budget, activeAccountIds, referenceDate])

  const category = categories.find((c) => c.id === budget.categoryId)
  const categoryLabel = getTranslatedCategoryName(category, t)
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

      {/* Rollover banner */}
      {usage && usage.rolloverAmount > 0 && (
        <div className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
          <RotateCcw size={11} className="shrink-0" />
          <span>
            {t('budgets.rolloverCarried', { amount: formatCurrency(usage.rolloverAmount, baseCurrency) })}
          </span>
        </div>
      )}

      {/* Progress */}
      <ProgressBar percent={percent} />

      {/* Amounts */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${statusColor}`}>
          {usage ? formatCurrency(usage.spent, baseCurrency) : '—'} {t('budgets.spent')}
        </span>
        <span className="text-gray-400">
          {t('budgets.of')} {usage ? formatCurrency(usage.limit, baseCurrency) : formatCurrency(budget.amount, baseCurrency)}
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
  }, [open, editing, reset])

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
                    {getTranslatedCategoryName(cat, t)}
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
            <Label htmlFor="bEnd">
              {t('budgets.endDate')} <span className="text-gray-400">({t('common.optional')})</span>
            </Label>
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

// ─── Category filter chip bar ─────────────────────────────────────────────────

function CategoryFilterBar({
  categories,
  selected,
  onChange,
}: {
  categories: Category[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          selected.length === 0
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-gray-200 bg-white text-gray-600'
        }`}
      >
        {t('budgets.allCategories')}
      </button>
      {categories.map((cat) => {
        const active = selected.includes(cat.id)
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => toggle(cat.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            <CategoryIcon name={cat.icon} size={11} />
            {getTranslatedCategoryName(cat, t)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { t } = useTranslation()
  const { budgets, remove } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  useAccountsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [referenceDate, setReferenceDate] = useState<Date>(() => startOfMonth(new Date()))
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([])

  const today = new Date()
  const isCurrentMonth = isSameMonth(referenceDate, today)

  // Only show categories that have at least one budget
  const budgetCategories = useMemo(
    () => categories.filter((c) => budgets.some((b) => b.categoryId === c.id)),
    [categories, budgets],
  )

  const filteredBudgets = useMemo(() => {
    if (filterCategoryIds.length === 0) return budgets
    return budgets.filter((b) => filterCategoryIds.includes(b.categoryId))
  }, [budgets, filterCategoryIds])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (b: Budget) => { setEditing(b); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setReferenceDate((d) => startOfMonth(subMonths(d, 1)))}
          className="rounded-full p-1.5 hover:bg-gray-100"
          aria-label={t('budgets.prevMonth')}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => setMonthPickerOpen(true)}
          className="flex items-center gap-1 rounded-full px-3 py-1 hover:bg-gray-100 transition-colors"
        >
          <span className="text-base font-bold">
            {format(referenceDate, 'MMMM yyyy')}
          </span>
          <ChevronDown size={14} className="text-gray-500" />
        </button>

        <button
          type="button"
          onClick={() => setReferenceDate((d) => startOfMonth(addMonths(d, 1)))}
          disabled={isCurrentMonth}
          className="rounded-full p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t('budgets.nextMonth')}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Category filter chips */}
      {budgetCategories.length > 1 && (
        <CategoryFilterBar
          categories={budgetCategories}
          selected={filterCategoryIds}
          onChange={setFilterCategoryIds}
        />
      )}

      {/* Budget list */}
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
              <BudgetCard
                budget={budget}
                referenceDate={referenceDate}
                onEdit={openEdit}
                onDelete={remove}
              />
            </li>
          ))}
        </ul>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={openAdd}
        aria-label={t('budgets.newBudget')}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>

      <BudgetDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
      <MonthPickerDialog
        key={monthPickerOpen ? format(referenceDate, 'yyyy-MM') : 'closed'}
        open={monthPickerOpen}
        current={referenceDate}
        onSelect={setReferenceDate}
        onClose={() => setMonthPickerOpen(false)}
      />
      <ScrollToTopButton />
    </div>
  )
}
