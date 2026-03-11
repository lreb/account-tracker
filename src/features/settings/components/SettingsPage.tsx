import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ChevronRight, Wallet, Tag, RefreshCw, Download, Upload, Table2 } from 'lucide-react'

import { useTransactionsStore } from '@/stores/transactions.store'
import { exportTransactionsCsv, parseTransactionsCsv } from '@/lib/csv'

const settingsItems = [
  { to: '/settings/accounts',       icon: Wallet,    labelKey: 'settings.accounts' },
  { to: '/settings/categories',     icon: Tag,       labelKey: 'settings.categories' },
  { to: '/settings/labels',         icon: Tag,       labelKey: 'settings.labels' },
  { to: '/settings/exchange-rates', icon: RefreshCw, labelKey: 'settings.exchangeRates' },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()
  const { transactions, add } = useTransactionsStore()
  const importRef = useRef<HTMLInputElement>(null)

  // ── Export ──────────────────────────────────────────────────────────────
  function handleExport() {
    if (transactions.length === 0) {
      toast.error('No transactions to export.')
      return
    }
    const filename = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`
    exportTransactionsCsv(transactions, filename)
    toast.success(`Exported ${transactions.length} transaction(s).`)
  }

  // ── Import ──────────────────────────────────────────────────────────────
  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string
        const { imported, skipped, errors } = parseTransactionsCsv(text)

        const existingIds = new Set(transactions.map((tx) => tx.id))
        const newTxs = imported.filter((tx) => !existingIds.has(tx.id))
        const duplicates = imported.length - newTxs.length

        for (const tx of newTxs) {
          await add(tx)
        }

        const inserted = newTxs.length
        if (inserted > 0) {
          toast.success(
            t('settings.csvImportSuccess', { count: inserted }) +
            (duplicates > 0 ? ` (${duplicates} duplicate(s) skipped)` : ''),
          )
        }
        if (skipped > 0) {
          toast.error(t('settings.csvImportSkipped', { skipped }))
          console.warn('CSV import skipped rows:', errors)
        }
        if (inserted === 0 && skipped === 0 && errors.length === 0) {
          toast.error('No rows found to import.')
        }
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

      {/* Data / CSV section */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">Data</p>

        <div className="rounded-2xl border divide-y overflow-hidden bg-white">
          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <Download size={18} className="text-green-600 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('settings.exportData')}</p>
              <p className="text-xs text-gray-400">{t('settings.exportCsvTransactions')}</p>
            </div>
            <Table2 size={14} className="text-gray-300" />
          </button>

          {/* Import */}
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <Upload size={18} className="text-indigo-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('settings.importData')}</p>
              <p className="text-xs text-gray-400">{t('settings.importCsvTransactions')}</p>
            </div>
            <Table2 size={14} className="text-gray-300" />
          </button>

          {/* Hidden file input */}
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </div>
    </div>
  )
}
