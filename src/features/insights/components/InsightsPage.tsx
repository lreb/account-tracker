import { useTranslation } from 'react-i18next'
import InsightsSavingCapacity from './InsightsSavingCapacity'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4 pb-24 space-y-5 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">{t('insights.title')}</h1>

      <InsightsSavingCapacity />
    </div>
  )
}

