import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getSpendingProjection } from '@/lib/insights'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpendingProjectionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  const projection = useMemo(() => {
    const nonCancelled = transactions.filter((tx) => tx.status !== 'cancelled')
    return getSpendingProjection(nonCancelled)
  }, [transactions])

  const getCategoryById = (id: string) => categories.find((c) => c.id === id)

  const progressPct = projection.totalProjectedCents > 0
    ? Math.min(100, Math.round((projection.totalSpentSoFarCents / projection.totalProjectedCents) * 100))
    : 0

  return (
    <>
      <div className="p-4 pb-24 max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">{t('insights.projection.title')}</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('insights.projection.hint', {
          elapsed: projection.daysElapsed,
          total: projection.daysInMonth,
        })}
      </p>

      {/* Summary card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('insights.projection.spentSoFar')}</p>
            <p className="text-2xl font-bold">
              {formatCurrency(projection.totalSpentSoFarCents, baseCurrency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('insights.projection.projectedTotal')}</p>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(projection.totalProjectedCents, baseCurrency)}
            </p>
          </div>
        </div>

        {/* Month progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t('insights.projection.daysElapsed', {
                elapsed: projection.daysElapsed,
                total: projection.daysInMonth,
              })}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* By category */}
      {projection.byCategory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {t('insights.projection.byCategory')}
          </h2>
          {projection.byCategory.map((item, idx) => {
            const category = getCategoryById(item.categoryId)
            const catBarFill = projection.totalProjectedCents > 0
              ? Math.min(100, Math.round((item.projectedCents / projection.totalProjectedCents) * 100))
              : 0
            return (
              <div
                key={`${item.categoryId}-${idx}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {category ? (
                    <CategoryIcon name={category.icon} size={16} />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm truncate font-medium">
                      {category?.name ?? item.categoryId}
                    </p>
                    <p className="text-sm font-semibold shrink-0 text-amber-600">
                      {formatCurrency(item.projectedCents, baseCurrency)}
                    </p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all"
                      style={{ width: `${catBarFill}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
      <ScrollToTopButton />
    </>
  )
}
