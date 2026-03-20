import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import i18n from '@/i18n'
import {
  ChevronRight, Wallet, Tag, RefreshCw,
  Download, Upload, Table2,
  FileJson, CloudUpload, CloudDownload, LogOut, Info, Globe,
} from 'lucide-react'

import { db } from '@/db'
import { createDefaultAccount } from '@/lib/accounts'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { exportTransactionsCsv, parseTransactionsCsv } from '@/lib/csv'
import {
  compactTransactionsYear,
  getCompactableTransactionYears,
  getCompactableTransactionsForYear,
} from '@/lib/retention'
import {
  buildFullBackup, downloadBackupFile,
  parseBackupFile, restoreFromBackup, resetApp,
} from '@/lib/backup'
import {
  isGoogleDriveConfigured, isSignedInToGoogle,
  startGoogleSignIn, signOutOfGoogle,
  uploadBackupToDrive, downloadBackupFromDrive,
} from '@/lib/google-drive'
import { COMMON_CURRENCIES } from '@/constants/currencies'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const settingsItems = [
  { to: '/settings/accounts',       icon: Wallet,    labelKey: 'settings.accounts' },
  { to: '/settings/categories',     icon: Tag,       labelKey: 'settings.categories' },
  { to: '/settings/labels',         icon: Tag,       labelKey: 'settings.labels' },
  { to: '/settings/exchange-rates', icon: RefreshCw, labelKey: 'settings.exchangeRates' },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()
  const { transactions, load: loadTransactions } = useTransactionsStore()
  const { accounts, load: loadAccounts } = useAccountsStore()
  const { categories, load: loadCategories } = useCategoriesStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const { load: loadBudgets } = useBudgetsStore()
  const { load: loadVehicles } = useVehiclesStore()
  const { load: loadSettings, saveSetting, language, baseCurrency, googleClientId } = useSettingsStore()
  const { load: loadExchangeRates } = useExchangeRatesStore()
  const importRef = useRef<HTMLInputElement>(null)
  const jsonImportRef = useRef<HTMLInputElement>(null)

  const [isBusy, setIsBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<null | (() => Promise<void>)>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmCompaction, setConfirmCompaction] = useState(false)
  const [postResetSetupOpen, setPostResetSetupOpen] = useState(false)
  const [postResetLanguage, setPostResetLanguage] = useState<'en' | 'es'>('en')
  const [postResetCurrency, setPostResetCurrency] = useState('USD')
  const [compactableYears, setCompactableYears] = useState<number[]>([])
  const [selectedCompactionYear, setSelectedCompactionYear] = useState<string>('')
  const [exportPreparedYear, setExportPreparedYear] = useState<number | null>(null)
  const [driveSignedIn, setDriveSignedIn] = useState(isSignedInToGoogle)
  
  // Track if we're showing the "bring your own client ID" config UI
  const [editingDriveConfig, setEditingDriveConfig] = useState(false)
  const [tempClientId, setTempClientId] = useState(googleClientId)

  const driveConfigured = isGoogleDriveConfigured(googleClientId)

  useEffect(() => {
    void refreshCompactionYears()
  }, [transactions.length])

  async function refreshCompactionYears() {
    const years = await getCompactableTransactionYears()
    setCompactableYears(years)

    setSelectedCompactionYear((current) => {
      if (years.length === 0) return ''
      if (current && years.includes(Number(current))) return current
      return String(years[0])
    })

    setExportPreparedYear((current) => {
      if (current && years.includes(current)) return current
      return null
    })
  }

  // ── Reload all stores (called after any restore) ───────────────────────────
  async function reloadAll() {
    await Promise.all([
      loadTransactions(), loadAccounts(), loadCategories(),
      loadLabels(), loadBudgets(), loadVehicles(),
      loadSettings(), loadExchangeRates(),
    ])
  }

  // ── Language ───────────────────────────────────────────────────────────────
  async function handleLanguageChange(lang: string) {
    await saveSetting('language', lang)
    await i18n.changeLanguage(lang)
  }

  // ── Base Currency ─────────────────────────────────────────────────────────
  async function handleBaseCurrencyChange(currency: string) {
    const nextCurrency = (currency || 'USD').toUpperCase()
    await saveSetting('baseCurrency', nextCurrency)
    toast.success(t('common.saved'))
  }

  // ── Data retention / manual compaction ───────────────────────────────────
  async function handleExportCompactionYear() {
    const year = Number(selectedCompactionYear)
    if (!year) return

    const txs = await getCompactableTransactionsForYear(year)
    if (txs.length === 0) {
      toast.error(t('settings.compactionNoTransactions'))
      return
    }

    const filename = `transactions_${year}_pre-compaction_${format(new Date(), 'yyyy-MM-dd')}.csv`
    exportTransactionsCsv(txs, accounts, labels, filename)
    setExportPreparedYear(year)
    toast.success(t('settings.compactionExportSuccess', { count: txs.length, year }))
  }

  async function handleCompactSelectedYear() {
    const year = Number(selectedCompactionYear)
    if (!year) return
    if (exportPreparedYear !== year) {
      toast.error(t('settings.compactionExportRequired'))
      return
    }

    setIsBusy(true)
    try {
      const result = await compactTransactionsYear(year)
      if (result.compactedCount === 0) {
        toast.error(t('settings.compactionNoTransactions'))
        return
      }

      await reloadAll()
      await refreshCompactionYears()
      setConfirmCompaction(false)
      toast.success(t('settings.compactionSuccess', {
        year,
        compacted: result.compactedCount,
        generated: result.generatedCount,
      }))
    } catch (err) {
      console.error(err)
      toast.error(t('settings.compactionError'))
    } finally {
      setIsBusy(false)
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────
  function handleCsvExport() {
    if (transactions.length === 0) { toast.error(t('settings.noDataToExport')); return }
    const filename = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`
    exportTransactionsCsv(transactions, accounts, labels, filename)
    toast.success(t('settings.exportSuccess', { count: transactions.length }))
  }

  // ── CSV Import ─────────────────────────────────────────────────────────────
  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string
        const {
          imported, skipped, errors,
          accountsToCreate, categoriesToCreate, labelsToCreate,
        } = parseTransactionsCsv(text, accounts, labels, categories)
        const existingIds = new Set(transactions.map((tx) => tx.id))
        const newTxs = imported.filter((tx) => !existingIds.has(tx.id))
        const duplicates = imported.length - newTxs.length
        if (newTxs.length > 0 || accountsToCreate.length > 0 || categoriesToCreate.length > 0 || labelsToCreate.length > 0) {
          await db.transaction('rw', db.accounts, db.categories, db.labels, db.transactions, async () => {
            if (accountsToCreate.length > 0) await db.accounts.bulkPut(accountsToCreate)
            if (categoriesToCreate.length > 0) await db.categories.bulkPut(categoriesToCreate)
            if (labelsToCreate.length > 0) await db.labels.bulkPut(labelsToCreate)
            if (newTxs.length > 0) await db.transactions.bulkPut(newTxs)
          })
          await Promise.all([loadAccounts(), loadCategories(), loadLabels(), loadTransactions()])
        }
        if (newTxs.length > 0) {
          const extrasSummary = t('settings.csvImportCreatedRefs', { accounts: accountsToCreate.length, categories: categoriesToCreate.length, labels: labelsToCreate.length })
          const duplicateSummary = duplicates > 0 ? ` ${t('settings.csvImportDuplicates', { count: duplicates })}` : ''
          toast.success(`${t('settings.csvImportSuccess', { count: newTxs.length })} ${extrasSummary}${duplicateSummary}`.trim())
        } else if (duplicates > 0) {
          toast.error(t('settings.csvImportDuplicatesOnly', { count: duplicates }))
        }
        if (skipped > 0) { toast.error(t('settings.csvImportSkipped', { skipped })); console.warn('CSV import skipped rows:', errors) }
        if (newTxs.length === 0 && skipped === 0 && errors.length === 0) toast.error(t('settings.csvImportNoRows'))
      } catch (err) {
        console.error(err)
        toast.error(t('settings.csvImportError'))
      } finally {
        e.target.value = ''
      }
    }
    reader.onerror = () => toast.error(t('settings.csvImportError'))
    reader.readAsText(file, 'UTF-8')
  }

  // ── JSON Backup Export ─────────────────────────────────────────────────────
  async function handleJsonExport() {
    if (isBusy) return
    setIsBusy(true)
    try {
      const backup = await buildFullBackup()
      const filename = `expense-backup_${format(new Date(), 'yyyy-MM-dd')}.json`
      downloadBackupFile(backup, filename)
      toast.success(t('settings.jsonExportSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(t('settings.jsonExportError'))
    } finally {
      setIsBusy(false)
    }
  }

  // ── JSON Backup Import ─────────────────────────────────────────────────────
  function handleJsonImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const backup = parseBackupFile(text)
        setConfirmRestore(() => async () => {
          setIsBusy(true)
          try {
            await restoreFromBackup(backup)
            await reloadAll()
            toast.success(t('settings.jsonRestoreSuccess'))
          } catch (err) {
            console.error(err)
            toast.error(t('settings.jsonRestoreError'))
          } finally {
            setIsBusy(false)
          }
        })
      } catch (err) {
        console.error(err)
        toast.error(t('settings.jsonImportParseError'))
      } finally {
        e.target.value = ''
      }
    }
    reader.onerror = () => toast.error(t('settings.jsonImportParseError'))
    reader.readAsText(file, 'UTF-8')
  }

  // ── Factory Reset ──────────────────────────────────────────────────────────
  async function handleResetConfirm() {
    setIsBusy(true)
    try {
      await resetApp()
      setConfirmReset(false)
      setPostResetLanguage((language === 'es' ? 'es' : 'en'))
      setPostResetCurrency((baseCurrency || 'USD').toUpperCase())
      setPostResetSetupOpen(true)
    } catch (err) {
      console.error(err)
      toast.error(t('settings.resetError'))
    } finally {
      setIsBusy(false)
    }
  }

  async function handlePostResetSetupSave() {
    setIsBusy(true)
    try {
      await saveSetting('language', postResetLanguage)
      await saveSetting('baseCurrency', postResetCurrency)
      await saveSetting('initialSetupDone', '1')
      await i18n.changeLanguage(postResetLanguage)

      const count = await db.accounts.count()
      if (count === 0) {
        await db.accounts.add(createDefaultAccount(postResetCurrency))
      }

      await reloadAll()
      setPostResetSetupOpen(false)
      toast.success(t('settings.resetSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(t('settings.resetError'))
    } finally {
      setIsBusy(false)
    }
  }

  // ── Google Drive: Connect / Disconnect ────────────────────────────────────
  function handleDriveConnect() {
    try {
      startGoogleSignIn(googleClientId, '/settings')
    } catch (err) {
      console.error(err)
      toast.error(t('settings.driveNotConfigured'))
    }
  }
  function handleDriveDisconnect() {
    signOutOfGoogle()
    setDriveSignedIn(false)
    toast.success(t('settings.driveDisconnected'))
  }

  async function handleSaveDriveConfig() {
    setIsBusy(true)
    try {
      const clientId = tempClientId.trim()
      if (!clientId) {
        toast.error(t('settings.driveNotConfigured'))
        return
      }

      await saveSetting('googleClientId', clientId)
      setEditingDriveConfig(false)
      toast.success(t('common.saved'))
      // Start OAuth immediately after config so user can connect in one flow.
      startGoogleSignIn(clientId, '/settings')
    } catch {
      toast.error(t('settings.saveError', 'Failed to save config'))
    } finally {
      setIsBusy(false)
    }
  }

  // ── Google Drive: Backup ──────────────────────────────────────────────────
  async function handleDriveBackup() {
    if (isBusy) return
    setIsBusy(true)
    try {
      const backup = await buildFullBackup()
      await uploadBackupToDrive(JSON.stringify(backup, null, 2))
      toast.success(t('settings.driveBackupSuccess'))
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('expired')) setDriveSignedIn(false)
      toast.error(msg)
    } finally {
      setIsBusy(false)
    }
  }

  // ── Google Drive: Restore ─────────────────────────────────────────────────
  async function handleDriveRestoreClick() {
    setConfirmRestore(() => async () => {
      setIsBusy(true)
      try {
        const text = await downloadBackupFromDrive()
        const backup = parseBackupFile(text)
        await restoreFromBackup(backup)
        await reloadAll()
        toast.success(t('settings.jsonRestoreSuccess'))
      } catch (err) {
        console.error(err)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('expired')) setDriveSignedIn(false)
        toast.error(msg)
      } finally {
        setIsBusy(false)
      }
    })
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      {/* Navigation items */}
      <div className="rounded-2xl border divide-y overflow-hidden bg-white">
        {settingsItems.map(({ to, icon: Icon, labelKey }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <Icon size={18} className="text-gray-500 shrink-0" />
            <span className="flex-1 text-sm font-medium">{t(labelKey)}</span>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>

      {/* ── Language section ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.sectionLanguage')}</p>
        <div className="rounded-2xl border divide-y overflow-hidden bg-white">
          {(['en', 'es'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <Globe size={18} className="text-gray-500 shrink-0" />
              <span className="flex-1 text-left text-sm font-medium">
                {lang === 'en' ? t('settings.languageEnglish') : t('settings.languageSpanish')}
              </span>
              {language === lang && (
                <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Base currency section ───────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.baseCurrency')}</p>
        <div className="rounded-2xl border overflow-hidden bg-white p-3">
          <Select
            value={baseCurrency || 'USD'}
            onValueChange={(v) => { void handleBaseCurrencyChange(v ?? 'USD') }}
            disabled={isBusy}
          >
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

      {/* ── Data retention / manual compaction ──────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.sectionRetention')}</p>
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <p className="text-xs text-gray-500">{t('settings.compactionDescription')}</p>

          <div className="space-y-1">
            <Label>{t('settings.compactionYear')}</Label>
            <Select
              value={selectedCompactionYear || undefined}
              onValueChange={(v) => {
                const next = v ?? ''
                setSelectedCompactionYear(next)
                if (Number(next) !== exportPreparedYear) {
                  setExportPreparedYear(null)
                }
              }}
              disabled={isBusy || compactableYears.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('settings.compactionNoYears')} />
              </SelectTrigger>
              <SelectContent>
                {compactableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={isBusy || !selectedCompactionYear}
              onClick={handleExportCompactionYear}
            >
              {t('settings.compactionExportFirst')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={isBusy || !selectedCompactionYear || exportPreparedYear !== Number(selectedCompactionYear)}
              onClick={() => setConfirmCompaction(true)}
            >
              {t('settings.compactionAction')}
            </Button>
          </div>

          {selectedCompactionYear && exportPreparedYear === Number(selectedCompactionYear) ? (
            <p className="text-xs text-emerald-600">{t('settings.compactionExportReady', { year: selectedCompactionYear })}</p>
          ) : (
            <p className="text-xs text-amber-600">{t('settings.compactionExportRequired')}</p>
          )}
        </div>
      </div>

      {/* ── CSV Data section ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.sectionCsv')}</p>
        <div className="rounded-2xl border divide-y overflow-hidden bg-white">
          <button type="button" onClick={handleCsvExport}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Download size={18} className="text-green-600 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('settings.exportData')}</p>
              <p className="text-xs text-gray-400">{t('settings.exportCsvTransactions')}</p>
            </div>
            <Table2 size={14} className="text-gray-300" />
          </button>
          <button type="button" onClick={() => importRef.current?.click()}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Upload size={18} className="text-indigo-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('settings.importData')}</p>
              <p className="text-xs text-gray-400">{t('settings.importCsvTransactions')}</p>
            </div>
            <Table2 size={14} className="text-gray-300" />
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportChange} />
        </div>
      </div>

      {/* ── JSON Backup & Restore section ────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.sectionBackup')}</p>
        <div className="rounded-2xl border divide-y overflow-hidden bg-white">
          <button type="button" onClick={handleJsonExport} disabled={isBusy}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <FileJson size={18} className="text-green-600 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('settings.jsonExport')}</p>
              <p className="text-xs text-gray-400">{t('settings.jsonExportDesc')}</p>
            </div>
          </button>
          <button type="button" onClick={() => jsonImportRef.current?.click()} disabled={isBusy}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <Upload size={18} className="text-amber-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('settings.jsonRestore')}</p>
              <p className="text-xs text-gray-400">{t('settings.jsonRestoreDesc')}</p>
            </div>
          </button>
          <input ref={jsonImportRef} type="file" accept=".json,application/json" className="hidden" onChange={handleJsonImportChange} />
        </div>
      </div>

      {/* ── Google Drive sync section ─────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.sectionDrive')}</p>

        {editingDriveConfig ? (
          <div className="rounded-2xl border bg-white p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">{t('settings.driveClientId')}</label>
              <input 
                type="text" 
                value={tempClientId} 
                onChange={(e) => setTempClientId(e.target.value)}
                placeholder="12345678-xxxx.apps.googleusercontent.com"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-gray-900"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {t('settings.driveClientIdHelp')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setEditingDriveConfig(false); setTempClientId(googleClientId); }}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleSaveDriveConfig} disabled={isBusy}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border divide-y overflow-hidden bg-white">
            {!driveSignedIn ? (
              <>
                <button type="button" onClick={handleDriveConnect}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <CloudUpload size={18} className="text-blue-500 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('settings.driveConnect')}</p>
                    <p className="text-xs text-gray-400">
                      {driveConfigured ? t('settings.driveConnectDesc') : t('settings.driveNotConfigured')}
                    </p>
                  </div>
                </button>
                <button type="button" onClick={() => { setTempClientId(googleClientId); setEditingDriveConfig(true); }}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <Info size={18} className="text-gray-400 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-600">{t('settings.driveConfigureBtn')}</p>
                  </div>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <p className="flex-1 text-sm text-gray-700">{t('settings.driveConnected')}</p>
                  <button type="button" onClick={handleDriveDisconnect}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                    <LogOut size={13} />
                    {t('settings.driveDisconnect')}
                  </button>
                </div>
                <button type="button" onClick={handleDriveBackup} disabled={isBusy}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  <CloudUpload size={18} className="text-indigo-500 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('settings.driveBackup')}</p>
                    <p className="text-xs text-gray-400">{t('settings.driveBackupDesc')}</p>
                  </div>
                </button>
                <button type="button" onClick={handleDriveRestoreClick} disabled={isBusy}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  <CloudDownload size={18} className="text-amber-500 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('settings.driveRestore')}</p>
                    <p className="text-xs text-gray-400">{t('settings.driveRestoreDesc')}</p>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-400 px-1">{t('settings.sectionDanger')}</p>
        <div className="rounded-2xl border border-red-100 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={isBusy}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-base">⚠</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-600">{t('settings.resetApp')}</p>
              <p className="text-xs text-gray-400">{t('settings.resetAppDesc')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Destructive restore confirmation dialog ──────────────────────── */}
      <Dialog open={!!confirmRestore} onOpenChange={(open) => { if (!open) setConfirmRestore(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.restoreConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('settings.restoreConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRestore(null)} disabled={isBusy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isBusy}
              onClick={async () => {
                if (confirmRestore) await confirmRestore()
                setConfirmRestore(null)
              }}
            >
              {isBusy ? t('common.loading') : t('settings.restoreConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Factory reset confirmation dialog ────────────────────────────── */}
      <Dialog open={confirmReset} onOpenChange={(open) => { if (!open && !isBusy) setConfirmReset(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('settings.resetConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('settings.resetConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)} disabled={isBusy}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" disabled={isBusy} onClick={handleResetConfirm}>
              {isBusy ? t('common.loading') : t('settings.resetConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Post-reset setup dialog (required) ───────────────────────────── */}
      <Dialog open={postResetSetupOpen} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.resetSetupTitle')}</DialogTitle>
            <DialogDescription>{t('settings.resetSetupDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. {t('settings.sectionLanguage')}</p>
              <div className="rounded-xl border overflow-hidden">
                {(['en', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setPostResetLanguage(lang)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span>{lang === 'en' ? t('settings.languageEnglish') : t('settings.languageSpanish')}</span>
                    {postResetLanguage === lang ? <span className="h-2 w-2 rounded-full bg-indigo-500" /> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">2. {t('settings.baseCurrency')}</p>
              <Select value={postResetCurrency} onValueChange={(v) => setPostResetCurrency(v ?? 'USD')}>
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

          <DialogFooter className="gap-2">
            <Button onClick={handlePostResetSetupSave} disabled={isBusy}>
              {isBusy ? t('common.loading') : t('settings.resetSetupAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Retention compaction confirmation dialog ─────────────────────── */}
      <Dialog open={confirmCompaction} onOpenChange={(open) => { if (!open && !isBusy) setConfirmCompaction(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.compactionConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.compactionConfirmDesc', { year: selectedCompactionYear || '-' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmCompaction(false)} disabled={isBusy}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleCompactSelectedYear} disabled={isBusy}>
              {isBusy ? t('common.loading') : t('settings.compactionAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

