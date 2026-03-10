import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

export default function VehicleDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">{t('vehicles.title')}</h1>
      <p className="text-xs text-gray-400 mb-4">ID: {id}</p>
      <p className="text-sm text-gray-400">{t('common.comingSoon')}</p>
    </div>
  )
}
