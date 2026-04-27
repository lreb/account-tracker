import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Repeat2, CalendarDays, RefreshCw } from 'lucide-react'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { detectRecurringPatterns } from '@/lib/insights'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecurringInsightsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  const patterns = useMemo(() => {
    const nonCancelled = transactions.filter((tx) => tx.status !== 'cancelled')
    return detectRecurringPatterns(nonCancelled)
  }, [transactions])

  const getCategoryById = (id: string) => categories.find((c) => c.id === id)

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
        <h1 className="text-xl font-bold">{t('insights.recurring.title')}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t('insights.recurring.hint')}</p>

      {patterns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <RefreshCw className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t('insights.recurring.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern, idx) => {
            const category = getCategoryById(pattern.categoryId)
            return (
              <div
                key={`${pattern.categoryId}-${idx}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  {category ? (
                    <CategoryIcon name={category.icon} size={18} />
                  ) : (
                    <Repeat2 className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {category?.name ?? pattern.categoryId}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {t('insights.recurring.aroundDay', { day: pattern.dayOfMonth })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('insights.recurring.occurrences', { count: pattern.occurrences })}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">
                    {formatCurrency(pattern.representativeAmount, baseCurrency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('insights.recurring.perMonth')}</p>
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
