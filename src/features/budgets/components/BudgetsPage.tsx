import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Plus, Pencil, Trash2, PiggyBank } from 'lucide-react'

import { budgetSchema, type BudgetFormValues } from '../schemas/budget.schema'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getBudgetUsage, type BudgetUsage } from '@/lib/budgets'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'
import type { Budget } from '@/types'

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
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const [usage, setUsage] = useState<BudgetUsage | null>(null)

  useEffect(() => {
    getBudgetUsage(budget).then(setUsage).catch(console.error)
  }, [budget])

  const category = categories.find((c) => c.id === budget.categoryId)
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
          <p className="text-sm font-semibold truncate">{category?.name ?? budget.categoryId}</p>
          <p className="text-xs text-gray-400 capitalize">{budget.period}</p>
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
          {usage ? formatCurrency(usage.spent, baseCurrency) : '—'} spent
        </span>
        <span className="text-gray-400">
          of {formatCurrency(budget.amount, baseCurrency)}
          {budget.rollover && (
            <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">
              rollover
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
  const { add, update } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: editing
      ? {
          categoryId: editing.categoryId,
          amount: (editing.amount / 100).toFixed(2),
          period: editing.period,
          rollover: editing.rollover,
          startDate: editing.startDate.slice(0, 10),
          endDate: editing.endDate?.slice(0, 10) ?? '',
        }
      : {
          period: 'monthly',
          rollover: false,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          amount: '',
          categoryId: '',
        },
  })

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
          <DialogTitle>{editing ? 'Edit Budget' : 'New Budget'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Category */}
          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              defaultValue={editing?.categoryId}
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
            {errors.categoryId && (
              <p className="text-xs text-red-500">{errors.categoryId.message}</p>
            )}
          </div>

          {/* Limit amount */}
          <div className="space-y-1">
            <Label htmlFor="bAmount">Limit ({baseCurrency})</Label>
            <Input
              id="bAmount"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('amount')}
            />
            {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
          </div>

          {/* Period */}
          <div className="space-y-1">
            <Label>Period</Label>
            <Select
              defaultValue={editing?.period ?? 'monthly'}
              onValueChange={(v) => setValue('period', v as BudgetFormValues['period'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start date */}
          <div className="space-y-1">
            <Label htmlFor="bStart">Start Date</Label>
            <Input id="bStart" type="date" {...register('startDate')} />
            {errors.startDate && (
              <p className="text-xs text-red-500">{errors.startDate.message}</p>
            )}
          </div>

          {/* End date (optional) */}
          <div className="space-y-1">
            <Label htmlFor="bEnd">End Date <span className="text-gray-400">(optional)</span></Label>
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
            <Label className="cursor-pointer">Roll over unspent balance</Label>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (b: Budget) => { setEditing(b); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('budgets.title')}</h1>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <PiggyBank size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">No budgets yet.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Create your first budget
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {budgets.map((budget) => (
            <li key={budget.id}>
              <BudgetCard budget={budget} onEdit={openEdit} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}

      <BudgetDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
    </div>
  )
}
