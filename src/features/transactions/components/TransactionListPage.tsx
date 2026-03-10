import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function TransactionListPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('transactions.title')}</h1>
        <Link
          to="/transactions/new"
          className="flex items-center gap-1 rounded-full bg-blue-600 text-white px-4 py-1.5 text-sm font-medium"
        >
          <Plus size={16} />
          {t('common.add')}
        </Link>
      </div>
      <p className="text-sm text-gray-400">{t('common.comingSoon')}</p>
    </div>
  )
}
