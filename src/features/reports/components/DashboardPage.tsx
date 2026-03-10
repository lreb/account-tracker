import { useTranslation } from 'react-i18next'

export default function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
        {t('dashboard.thisMonth')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.income')}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">—</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.expenses')}</p>
          <p className="text-2xl font-bold text-red-500 mt-1">—</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{t('dashboard.balance')}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
      </div>
    </div>
  )
}
