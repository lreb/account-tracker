import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/currency'
import type { Budget } from '@/types'

interface BudgetRow {
  budget: Budget
  spent: number
  percent: number
  catName: string
}

interface DashboardBudgetHealthProps {
  topBudgets: BudgetRow[]
  baseCurrency: string
}

export function DashboardBudgetHealth({ topBudgets, baseCurrency }: DashboardBudgetHealthProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {t('dashboard.budgetHealth')}
        </p>
        <Link to="/budgets" className="text-xs text-indigo-600 hover:underline">
          {t('dashboard.viewAll')}
        </Link>
      </div>
      {topBudgets.map(({ budget, spent, percent, catName }) => (
        <div key={budget.id} className="space-y-1">
          <div className="flex justify-between text-xs text-gray-700">
            <span className="truncate">{catName}</span>
            <span className={percent >= 100 ? 'text-red-500 font-semibold' : percent >= 75 ? 'text-amber-500' : 'text-gray-500'}>
              {percent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                percent >= 100 ? 'bg-red-500' : percent >= 75 ? 'bg-amber-400' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            {formatCurrency(spent, baseCurrency)} / {formatCurrency(budget.amount, baseCurrency)}
          </p>
        </div>
      ))}
    </div>
  )
}
