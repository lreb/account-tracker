import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { Transaction, Account, Category } from '@/types'

interface DashboardRecentTransactionsProps {
  recent: Transaction[]
  accounts: Account[]
  categories: Category[]
}

export function DashboardRecentTransactions({
  recent,
  accounts,
  categories,
}: DashboardRecentTransactionsProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {t('dashboard.recent')}
        </p>
        <Link to="/transactions" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
          {t('dashboard.viewAll')} <ArrowRight size={11} />
        </Link>
      </div>
      <ul className="divide-y">
        {recent.map((tx) => {
          const cat = categories.find((c) => c.id === tx.categoryId)
          const acc = accounts.find((a) => a.id === tx.accountId)
          return (
            <li key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-800">{tx.description}</p>
                <p className="text-xs text-gray-400 truncate">
                  {cat?.name ?? '—'} · {acc?.name ?? '—'} · {format(new Date(tx.date), 'MMM d')}
                </p>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${
                tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-500' : 'text-gray-500'
              }`}>
                {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                {formatCurrency(tx.amount, tx.currency)}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
