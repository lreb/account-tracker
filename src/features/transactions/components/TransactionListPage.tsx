import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatCurrency } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'

export default function TransactionListPage() {
  const { t } = useTranslation()
  const { transactions, load: loadTx } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()

  useEffect(() => { loadTx() }, [loadTx])

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id

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

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center mt-12">
          No transactions yet. Tap + to add one.
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Link
                to={`/transactions/${tx.id}`}
                className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-xs text-gray-400">
                    {getCategoryName(tx.categoryId)} · {getAccountName(tx.accountId)} · {format(new Date(tx.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${
                    tx.type === 'income' ? 'text-green-600' :
                    tx.type === 'expense' ? 'text-red-500' : 'text-gray-700'
                  }`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {formatCurrency(tx.amount, tx.currency ?? baseCurrency)}
                  </p>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {t(`transactions.status.${tx.status}`)}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
