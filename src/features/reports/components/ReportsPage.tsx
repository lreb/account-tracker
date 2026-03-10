import { useTranslation } from 'react-i18next'

export default function ReportsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">{t('nav.reports')}</h1>
      <p className="text-sm text-gray-400">{t('common.comingSoon')}</p>
    </div>
  )
}
