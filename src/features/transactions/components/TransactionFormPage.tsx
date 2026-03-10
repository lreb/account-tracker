import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

export default function TransactionFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">
        {isEdit ? t('transactions.edit') : t('transactions.new')}
      </h1>
      <p className="text-sm text-gray-400">{t('common.comingSoon')}</p>
    </div>
  )
}
