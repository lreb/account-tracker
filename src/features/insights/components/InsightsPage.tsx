import { useMemo, useDeferredValue, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Repeat2, TriangleAlert, Lightbulb, TrendingUp, ChevronRight } from 'lucide-react'
import { useTransactionsStore } from '@/stores/transactions.store'
import {
  detectRecurringPatterns,
  getCategoryAlerts,
  getSavingsSuggestions,
  getSpendingProjection,
} from '@/lib/insights'
import InsightsSavingCapacity from './InsightsSavingCapacity'
import AiAnalysisPanel from './AiAnalysisPanel'

// ── Nav card ──────────────────────────────────────────────────────────────────

interface InsightCardProps {
  icon: ReactNode
  title: string
  description: string
  badge?: number
  badgeColor?: 'amber' | 'red' | 'blue' | 'emerald'
  onClick: () => void
}

function InsightNavCard({ icon, title, description, badge, badgeColor = 'amber', onClick }: InsightCardProps) {
  const colorMap = {
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent active:scale-[0.98]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorMap[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions: raw } = useTransactionsStore()

  const transactions = useDeferredValue(raw)

  const { recurringCount, alertCount, savingsCount, projection } = useMemo(() => {
    const nonCancelled = transactions.filter((tx) => tx.status !== 'cancelled')
    return {
      recurringCount: detectRecurringPatterns(nonCancelled).length,
      alertCount: getCategoryAlerts(nonCancelled).length,
      savingsCount: getSavingsSuggestions(nonCancelled).length,
      projection: getSpendingProjection(nonCancelled),
    }
  }, [transactions])

  return (
    <div className="p-4 pb-24 space-y-5 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">{t('insights.title')}</h1>

      <InsightsSavingCapacity />

      <AiAnalysisPanel />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          {t('insights.analysisTitle')}
        </h2>

        <InsightNavCard
          icon={<Repeat2 className="h-5 w-5" />}
          title={t('insights.recurring.title')}
          description={t('insights.recurring.description')}
          badge={recurringCount}
          badgeColor="blue"
          onClick={() => navigate('recurring')}
        />

        <InsightNavCard
          icon={<TriangleAlert className="h-5 w-5" />}
          title={t('insights.categoryAlerts.title')}
          description={t('insights.categoryAlerts.description')}
          badge={alertCount}
          badgeColor="red"
          onClick={() => navigate('category-alerts')}
        />

        <InsightNavCard
          icon={<Lightbulb className="h-5 w-5" />}
          title={t('insights.savings.title')}
          description={t('insights.savings.description')}
          badge={savingsCount}
          badgeColor="emerald"
          onClick={() => navigate('savings')}
        />

        <InsightNavCard
          icon={<TrendingUp className="h-5 w-5" />}
          title={t('insights.projection.title')}
          description={t('insights.projection.projectedLabel', {
            count: projection.daysElapsed,
            total: projection.daysInMonth,
          })}
          onClick={() => navigate('projection')}
        />
      </div>

      <AiAnalysisPanel />
    </div>
  )
}

