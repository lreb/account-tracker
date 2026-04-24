import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'

import { budgetSchema, type BudgetFormValues } from '../schemas/budget.schema'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getTranslatedCategoryName, sortCategories } from '@/lib/categories'
import type { Budget } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function BudgetDialog({
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
                <SelectValue placeholder={t('budgets.selectCategory')}>
                  {watch('categoryId')
                    ? getTranslatedCategoryName(categories.find((c) => c.id === watch('categoryId')), t)
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortCategories(categories, t).map((cat) => (
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
                <SelectValue>
                  {watch('period') ? t(`budgets.periods.${watch('period')}`) : null}
                </SelectValue>
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
