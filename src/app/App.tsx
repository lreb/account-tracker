import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import i18n from '@/i18n'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'

function AppLoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  const [appReady, setAppReady] = useState(false)
  const loadTransactions = useTransactionsStore((s) => s.load)
  const loadAccounts     = useAccountsStore((s) => s.load)
  const loadCategories   = useCategoriesStore((s) => s.load)
  const loadBudgets      = useBudgetsStore((s) => s.load)
  const loadVehicles     = useVehiclesStore((s) => s.load)
  const loadSettings     = useSettingsStore((s) => s.load)
  const language         = useSettingsStore((s) => s.language)

  // Keep i18n in sync with the persisted language preference
  useEffect(() => { void i18n.changeLanguage(language) }, [language])

  useEffect(() => {
    void Promise.all([
      loadTransactions(),
      loadAccounts(),
      loadCategories(),
      loadBudgets(),
      loadVehicles(),
      loadSettings(),
    ]).then(() => setAppReady(true))
  }, [loadTransactions, loadAccounts, loadCategories, loadBudgets, loadVehicles, loadSettings])

  if (!appReady) return <AppLoadingScreen />

  return <RouterProvider router={router} />
}
