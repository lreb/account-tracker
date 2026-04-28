import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lightbulb, Sparkles } from 'lucide-react'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getSavingsSuggestions } from '@/lib/insights'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'
import type { SavingsSuggestion } from '@/lib/insights'

// ── Page ──────────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<SavingsSuggestion['priority'], { badge: string; bar: string }> = {
  high:   { badge: 'bg-red-100 text-red-700',     bar: 'bg-red-500' },
  medium: { badge: 'bg-amber-100 text-amber-700',  bar: 'bg-amber-400' },
  low:    { badge: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-400' },
}

export default function SavingsSuggestionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  const suggestions = useMemo(() => {
    const nonCancelled = transactions.filter((tx) => tx.status !== 'cancelled')
    return getSavingsSuggestions(nonCancelled)
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
        <h1 className="text-xl font-bold">{t('insights.savings.title')}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t('insights.savings.hint')}</p>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 text-emerald-500 opacity-70" />
          <p className="text-sm">{t('insights.savings.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const category = getCategoryById(suggestion.categoryId)
            const styles = PRIORITY_STYLES[suggestion.priority]
            const barFill = suggestion.currentMonthCents > 0
              ? Math.min(100, Math.round((suggestion.avgCents / suggestion.currentMonthCents) * 100))
              : 0

            return (
              <div
                key={suggestion.categoryId}
                className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    {category ? (
                      <CategoryIcon name={category.icon} size={18} />
                    ) : (
                      <Lightbulb className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {category?.name ?? suggestion.categoryId}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}>
                        {t(`insights.savings.priority.${suggestion.priority}`)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('insights.savings.couldSave', {
                        amount: formatCurrency(suggestion.potentialSavingCents, baseCurrency),
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">
                      {formatCurrency(suggestion.currentMonthCents, baseCurrency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('insights.savings.target', {
                        avg: formatCurrency(suggestion.avgCents, baseCurrency),
                      })}
                    </p>
                  </div>
                </div>

                {/* Bar: target (avg) vs current */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${styles.bar}`}
                      style={{ width: `${barFill}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{t('insights.savings.targetLabel')}</span>
                    <span>{t('insights.savings.currentLabel')}</span>
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
