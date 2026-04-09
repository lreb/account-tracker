import { useTranslation } from 'react-i18next'

interface TransactionDateGroupHeaderProps {
  headerLabel: string
  count: number
}

export function TransactionDateGroupHeader({ headerLabel, count }: TransactionDateGroupHeaderProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between pt-3 pb-2 px-1">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {headerLabel}
      </h2>
      <span className="text-xs text-gray-400">
        {count} {count === 1 ? t('transactions.record') : t('transactions.records')}
      </span>
    </div>
  )
}
