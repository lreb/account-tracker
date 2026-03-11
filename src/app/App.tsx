import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'

export default function App() {
  const loadTransactions = useTransactionsStore((s) => s.load)
  const loadAccounts     = useAccountsStore((s) => s.load)
  const loadCategories   = useCategoriesStore((s) => s.load)
  const loadBudgets      = useBudgetsStore((s) => s.load)
  const loadVehicles     = useVehiclesStore((s) => s.load)
  const loadSettings     = useSettingsStore((s) => s.load)

  useEffect(() => {
    void Promise.all([
      loadTransactions(),
      loadAccounts(),
      loadCategories(),
      loadBudgets(),
      loadVehicles(),
      loadSettings(),
    ])
  }, [loadTransactions, loadAccounts, loadCategories, loadBudgets, loadVehicles, loadSettings])

  return <RouterProvider router={router} />
}
