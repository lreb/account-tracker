import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'

import { getActiveAccountIds } from '@/lib/accounts'
import { getPeriodRange } from '@/lib/dates'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getBudgetUsage, type BudgetUsage } from '@/lib/budgets'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'
import { getTranslatedCategoryName } from '@/lib/categories'
import type { Budget } from '@/types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from './ProgressBar'

export function BudgetCard({
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

  const { start, end } = getPeriodRange(budget.period, referenceDate)
  const baseLink = `/transactions?categoryId=${budget.categoryId}&dateFrom=${format(start, 'yyyy-MM-dd')}&dateTo=${format(end, 'yyyy-MM-dd')}`
  const txLink = `${baseLink}&returnTo=${encodeURIComponent(baseLink)}`

  return (
    <Link to={txLink} className="block rounded-2xl border bg-white px-4 pt-3 pb-4 space-y-3 hover:bg-gray-50 transition-colors">
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); onEdit(budget) }}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            onClick={(e) => { e.preventDefault(); onDelete(budget.id) }}
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
    </Link>
  )
}
