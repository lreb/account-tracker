import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { exportTransactionsCsv } from '@/lib/csv'
import {
  compactTransactionsYear,
  getCompactableTransactionYears,
  getCompactableTransactionsForYear,
} from '@/lib/retention'
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

export default function DataRetentionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions, load: loadTransactions } = useTransactionsStore()
  const { accounts, load: loadAccounts } = useAccountsStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const { load: loadCategories } = useCategoriesStore()
  const { load: loadBudgets } = useBudgetsStore()
  const { load: loadVehicles } = useVehiclesStore()
  const { load: loadSettings } = useSettingsStore()
  const { load: loadExchangeRates } = useExchangeRatesStore()

  const [isBusy, setIsBusy] = useState(false)
  const [confirmCompaction, setConfirmCompaction] = useState(false)
  const [compactableYears, setCompactableYears] = useState<number[]>([])
  const [selectedCompactionYear, setSelectedCompactionYear] = useState<string>('')
  const [exportPreparedYear, setExportPreparedYear] = useState<number | null>(null)

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

  async function reloadAll() {
    await Promise.all([
      loadTransactions(), loadAccounts(), loadCategories(),
      loadLabels(), loadBudgets(), loadVehicles(),
      loadSettings(), loadExchangeRates(),
    ])
  }

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

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">{t('settings.dataRetentionTitle')}</h1>
      </div>

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
