import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TriangleAlert, CheckCircle2 } from 'lucide-react'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getCategoryAlerts } from '@/lib/insights'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CategoryAlertsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  const alerts = useMemo(() => {
    const nonCancelled = transactions.filter((tx) => tx.status !== 'cancelled')
    return getCategoryAlerts(nonCancelled)
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
        <h1 className="text-xl font-bold">{t('insights.categoryAlerts.title')}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t('insights.categoryAlerts.hint')}</p>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-70" />
          <p className="text-sm">{t('insights.categoryAlerts.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, idx) => {
            const category = getCategoryById(alert.categoryId)
            const severity = alert.percentAbove >= 50 ? 'red' : 'amber'
            const barFill = Math.min(100, Math.round((alert.currentMonthCents / (alert.avgCents + alert.stdDevCents * 2)) * 100))

            return (
              <div
                key={`${alert.categoryId}-${idx}`}
                className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      severity === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {category ? (
                      <CategoryIcon name={category.icon} size={18} />
                    ) : (
                      <TriangleAlert className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {category?.name ?? alert.categoryId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('insights.categoryAlerts.percentAbove', { pct: alert.percentAbove })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">
                      {formatCurrency(alert.currentMonthCents, baseCurrency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('insights.categoryAlerts.avg', {
                        avg: formatCurrency(alert.avgCents, baseCurrency),
                      })}
                    </p>
                  </div>
                </div>

                {/* Progress bar: current vs avg threshold */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        severity === 'red' ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${barFill}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{t('insights.categoryAlerts.avg3m')}</span>
                    <span>{t('insights.categoryAlerts.thisMonth')}</span>
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
