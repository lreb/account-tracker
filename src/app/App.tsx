import { useCallback, useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import i18n from '@/i18n'
import { db } from '@/db'
import { createDefaultAccount } from '@/lib/accounts'
import { COMMON_CURRENCIES } from '@/constants/currencies'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const [requiresInitialSetup, setRequiresInitialSetup] = useState(false)
  const [initialLanguage, setInitialLanguage] = useState<'en' | 'es'>('en')
  const [initialCurrency, setInitialCurrency] = useState('USD')
  const [isSavingSetup, setIsSavingSetup] = useState(false)

  const loadTransactions = useTransactionsStore((s) => s.load)
  const loadAccounts     = useAccountsStore((s) => s.load)
  const loadCategories   = useCategoriesStore((s) => s.load)
  const loadBudgets      = useBudgetsStore((s) => s.load)
  const loadVehicles     = useVehiclesStore((s) => s.load)
  const loadSettings     = useSettingsStore((s) => s.load)
  const saveSetting      = useSettingsStore((s) => s.saveSetting)
  const language         = useSettingsStore((s) => s.language)

  const loadAllStores = useCallback(async () => {
    await Promise.all([
      loadTransactions(),
      loadAccounts(),
      loadCategories(),
      loadBudgets(),
      loadVehicles(),
      loadSettings(),
    ])
  }, [loadTransactions, loadAccounts, loadCategories, loadBudgets, loadVehicles, loadSettings])

  // Keep i18n in sync with the persisted language preference
  useEffect(() => { void i18n.changeLanguage(language) }, [language])

  useEffect(() => {
    void (async () => {
      await loadSettings()

      const setupDone = await db.settings.get('initialSetupDone')
      if (setupDone?.value === '1') {
        await loadAllStores()
        setAppReady(true)
        return
      }

      const savedLanguage = await db.settings.get('language')
      const savedCurrency = await db.settings.get('baseCurrency')
      setInitialLanguage(savedLanguage?.value === 'es' ? 'es' : 'en')
      setInitialCurrency((savedCurrency?.value || 'USD').toUpperCase())

      setRequiresInitialSetup(true)
      setAppReady(true)
    })()
  }, [loadSettings, loadAllStores])

  async function handleInitialSetupSave() {
    setIsSavingSetup(true)
    try {
      await saveSetting('language', initialLanguage)
      await saveSetting('baseCurrency', initialCurrency)
      await saveSetting('initialSetupDone', '1')
      await i18n.changeLanguage(initialLanguage)

      const accountCount = await db.accounts.count()
      if (accountCount === 0) {
        await db.accounts.add(createDefaultAccount(initialCurrency))
      }

      await loadAllStores()
      setRequiresInitialSetup(false)
    } finally {
      setIsSavingSetup(false)
    }
  }

  if (!appReady) return <AppLoadingScreen />

  if (requiresInitialSetup) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border bg-white p-5 space-y-5 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{i18n.t('settings.resetSetupTitle')}</h1>
            <p className="text-sm text-gray-500">{i18n.t('settings.resetSetupDesc')}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. {i18n.t('settings.sectionLanguage')}</p>
              <div className="rounded-xl border overflow-hidden">
                {(['en', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setInitialLanguage(lang)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span>{lang === 'en' ? i18n.t('settings.languageEnglish') : i18n.t('settings.languageSpanish')}</span>
                    {initialLanguage === lang ? <span className="h-2 w-2 rounded-full bg-indigo-500" /> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">2. {i18n.t('settings.baseCurrency')}</p>
              <Select value={initialCurrency} onValueChange={(v) => setInitialCurrency(v ?? 'USD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CURRENCIES.map(({ code, label }) => (
                    <SelectItem key={code} value={code}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full" onClick={handleInitialSetupSave} disabled={isSavingSetup}>
            {isSavingSetup ? i18n.t('common.loading') : i18n.t('settings.resetSetupAction')}
          </Button>
        </div>
      </div>
    )
  }

  return <RouterProvider router={router} />
}
