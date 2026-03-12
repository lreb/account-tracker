import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, SlidersHorizontal, X } from 'lucide-react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLabelsStore } from '@/stores/labels.store'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'

type TxType = 'income' | 'expense' | 'transfer'
type TxStatus = 'cleared' | 'pending' | 'reconciled' | 'cancelled'

interface Filters {
  search: string
  type: TxType | ''
  categoryId: string
  accountId: string
  labelId: string
  status: TxStatus | ''
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  type: '',
  categoryId: '',
  accountId: '',
  labelId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

// Persists across component mounts within the same session
let persistedFilters: Filters = { ...EMPTY_FILTERS }

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense',  label: 'transactions.expense' },
  { value: 'income',   label: 'transactions.income' },
  { value: 'transfer', label: 'transactions.transfer' },
]

const STATUS_OPTIONS: { value: TxStatus; label: string }[] = [
  { value: 'cleared',    label: 'transactions.status.cleared' },
  { value: 'pending',    label: 'transactions.status.pending' },
  { value: 'reconciled', label: 'transactions.status.reconciled' },
  { value: 'cancelled',  label: 'transactions.status.cancelled' },
]

export default function TransactionListPage() {
  const { t } = useTranslation()
  const { transactions, load: loadTx } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()
  const { labels, load: loadLabels } = useLabelsStore()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [filters, setFiltersRaw] = useState<Filters>(persistedFilters)
  // draft = filters being edited inside the sheet; only committed on Apply
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)

  // Keep module-level cache in sync so filters survive navigation
  const setFilters = (next: Filters | ((prev: Filters) => Filters)) => {
    setFiltersRaw((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      persistedFilters = value
      return value
    })
  }

  useEffect(() => { loadTx(); loadLabels() }, [loadTx, loadLabels])

  const openSheet = () => { setDraft(filters); setSheetOpen(true) }
  const applyFilters = () => { setFilters(draft); setSheetOpen(false) }
  const resetFilters = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setSheetOpen(false) }
  const removeChip = (key: keyof Filters) =>
    setFilters((prev) => ({ ...prev, [key]: '' }))

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return transactions.filter((tx) => {
      if (q && !tx.description.toLowerCase().includes(q) && !(tx.notes ?? '').toLowerCase().includes(q)) return false
      if (filters.type && tx.type !== filters.type) return false
      if (filters.categoryId && tx.categoryId !== filters.categoryId) return false
      if (filters.accountId && tx.accountId !== filters.accountId) return false
      if (filters.labelId && !(tx.labels ?? []).includes(filters.labelId)) return false
      if (filters.status && tx.status !== filters.status) return false
      if (filters.dateFrom && tx.date < new Date(filters.dateFrom).toISOString()) return false
      if (filters.dateTo) {
        const end = new Date(filters.dateTo)
        end.setHours(23, 59, 59, 999)
        if (tx.date > end.toISOString()) return false
      }
      return true
    })
  }, [transactions, filters])

  // Compute running balance per account across ALL transactions (sorted chronologically)
  const balanceAfterTx = useMemo(() => {
    const accBalances = new Map<string, number>()
    for (const acc of accounts) accBalances.set(acc.id, acc.openingBalance)

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const result = new Map<string, { accountBalance: number; accountCurrency: string; toAccountBalance?: number; toAccountCurrency?: string }>()

    for (const tx of sorted) {
      const bal = accBalances.get(tx.accountId) ?? 0
      const acc = accounts.find((a) => a.id === tx.accountId)

      if (tx.type === 'income') {
        accBalances.set(tx.accountId, bal + tx.amount)
      } else if (tx.type === 'expense') {
        accBalances.set(tx.accountId, bal - tx.amount)
      } else if (tx.type === 'transfer') {
        accBalances.set(tx.accountId, bal - tx.amount)
        if (tx.toAccountId) {
          const destBal = accBalances.get(tx.toAccountId) ?? 0
          const creditAmount = tx.originalAmount ?? tx.amount
          accBalances.set(tx.toAccountId, destBal + creditAmount)
        }
      }

      const entry: { accountBalance: number; accountCurrency: string; toAccountBalance?: number; toAccountCurrency?: string } = {
        accountBalance: accBalances.get(tx.accountId) ?? 0,
        accountCurrency: acc?.currency ?? tx.currency ?? baseCurrency,
      }

      if (tx.type === 'transfer' && tx.toAccountId) {
        const toAcc = accounts.find((a) => a.id === tx.toAccountId)
        entry.toAccountBalance = accBalances.get(tx.toAccountId) ?? 0
        entry.toAccountCurrency = toAcc?.currency ?? baseCurrency
      }

      result.set(tx.id, entry)
    }
    return result
  }, [transactions, accounts, baseCurrency])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const tx of filtered) {
      const key = format(parseISO(tx.date), 'yyyy-MM-dd')
      const arr = map.get(key)
      if (arr) arr.push(tx)
      else map.set(key, [tx])
    }
    return Array.from(map.entries()).map(([dateKey, txs]) => ({ dateKey, txs }))
  }, [filtered])

  const formatDateHeader = (dateKey: string) => {
    const d = parseISO(dateKey)
    if (isToday(d)) return t('transactions.today')
    if (isYesterday(d)) return t('transactions.yesterday')
    return format(d, 'EEEE, MMM d, yyyy')
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  const chips: { key: keyof Filters; label: string }[] = [
    filters.search    ? { key: 'search',     label: `"${filters.search}"` }                                              : null,
    filters.type      ? { key: 'type',        label: t(`transactions.${filters.type}`) }                                 : null,
    filters.categoryId? { key: 'categoryId',  label: categories.find((c) => c.id === filters.categoryId)?.name ?? '' }   : null,
    filters.accountId ? { key: 'accountId',   label: accounts.find((a) => a.id === filters.accountId)?.name ?? '' }      : null,
    filters.labelId   ? { key: 'labelId',      label: labels.find((l) => l.id === filters.labelId)?.name ?? '' }           : null,
    filters.status    ? { key: 'status',      label: t(`transactions.status.${filters.status}`) }                        : null,
    filters.dateFrom  ? { key: 'dateFrom',    label: `From ${filters.dateFrom}` }                                        : null,
    filters.dateTo    ? { key: 'dateTo',      label: `To ${filters.dateTo}` }                                            : null,
  ].filter(Boolean) as { key: keyof Filters; label: string }[]

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">{t('transactions.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSheet}
            className="relative flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm"
          >
            <SlidersHorizontal size={14} />
            {t('transactions.filters.button')}
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
          <Link
            to="/transactions/new"
            className="flex items-center gap-1 rounded-full bg-indigo-600 text-white px-4 py-1.5 text-sm font-medium"
          >
            <Plus size={16} />
            {t('common.add')}
          </Link>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => removeChip(key)}
              className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs text-indigo-700"
            >
              {label} <X size={10} />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
            >
              {t('transactions.clearAll')}
            </button>
          )}
        </div>
      )}

      {/* List */}
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center mt-12">
          {t('transactions.noTransactions')}
        </p>
      ) : filtered.length === 0 ? (
        <div className="text-center mt-12 space-y-2">
          <p className="text-sm text-gray-400">{t('transactions.noMatch')}</p>
          <Button variant="outline" size="sm" onClick={resetFilters}>{t('transactions.clearFilters')}</Button>
        </div>
      ) : (
        <ul className="space-y-5">
          {grouped.map(({ dateKey, txs }) => (
            <li key={dateKey}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {formatDateHeader(dateKey)}
                </h2>
                <span className="text-xs text-gray-400">
                  {txs.length} {txs.length === 1 ? t('transactions.record') : t('transactions.records')}
                </span>
              </div>
              <ul className="space-y-2">
                {txs.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId)
                  const acc = accounts.find((a) => a.id === tx.accountId)
                  const toAcc = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : undefined
                  const bal = balanceAfterTx.get(tx.id)
                  return (
                    <li key={tx.id}>
                      <Link
                        to={`/transactions/${tx.id}`}
                        className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {cat?.name ?? '—'} · {acc?.name ?? '—'} · {format(parseISO(tx.date), 'h:mm a')}
                          </p>
                          {(tx.labels ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(tx.labels ?? []).map((lid) => {
                                const lbl = labels.find((l) => l.id === lid)
                                if (!lbl) return null
                                return (
                                  <span
                                    key={lid}
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                                    style={{ borderColor: lbl.color ?? '#6b7280', color: lbl.color ?? '#6b7280', backgroundColor: `${lbl.color ?? '#6b7280'}18` }}
                                  >
                                    {lbl.name}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${
                            tx.type === 'income' ? 'text-green-600' :
                            tx.type === 'expense' ? 'text-red-500' : 'text-gray-700'
                          }`}>
                            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                            {formatCurrency(tx.amount, tx.currency ?? baseCurrency)}
                          </p>
                          {bal && (
                            <div className="mt-0.5 space-y-0.5">
                              <p className="text-[11px] text-gray-400">
                                {acc?.name}: <span className={bal.accountBalance < 0 ? 'text-red-400' : 'text-gray-500'}>{formatCurrency(bal.accountBalance, bal.accountCurrency)}</span>
                              </p>
                              {tx.type === 'transfer' && bal.toAccountBalance != null && bal.toAccountCurrency && (
                                <p className="text-[11px] text-gray-400">
                                  {toAcc?.name}: <span className={bal.toAccountBalance < 0 ? 'text-red-400' : 'text-gray-500'}>{formatCurrency(bal.toAccountBalance, bal.toAccountCurrency)}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {/* Filter sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>{t('transactions.filters.title')}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="space-y-1">
              <Label>{t('transactions.filters.keyword')}</Label>
              <Input
                placeholder={t('transactions.filters.keywordPlaceholder')}
                value={draft.search}
                onChange={(e) => setDraft((p) => ({ ...p, search: e.target.value }))}
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('transactions.filters.dateFrom')}</Label>
                <Input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft((p) => ({ ...p, dateFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('transactions.filters.dateTo')}</Label>
                <Input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) => setDraft((p) => ({ ...p, dateTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label>{t('transactions.filters.type')}</Label>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
                {[{ value: '' as const, label: 'transactions.filters.all' }, ...TYPE_OPTIONS].map(({ value, label }) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, type: value as Filters['type'] }))}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      draft.type === value ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <Label>{t('transactions.filters.category')}</Label>
              <Select
                value={draft.categoryId || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, categoryId: v === '__all__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.categoryId ? categories.find((c) => c.id === draft.categoryId)?.name : t('transactions.filters.allCategories')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allCategories')}</SelectItem>
                  {categories.filter((cat) => !cat.deletedAt).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account */}
            <div className="space-y-1">
              <Label>{t('transactions.filters.account')}</Label>
              <Select
                value={draft.accountId || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, accountId: v === '__all__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.accountId ? accounts.find((a) => a.id === draft.accountId)?.name : t('transactions.filters.allAccounts')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allAccounts')}</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label */}
            {labels.length > 0 && (
              <div className="space-y-1">
                <Label>{t('settings.labels')}</Label>
                <Select
                  value={draft.labelId || '__all__'}
                  onValueChange={(v) => setDraft((p) => ({ ...p, labelId: v === '__all__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {draft.labelId ? labels.find((l) => l.id === draft.labelId)?.name : t('transactions.filters.allLabels')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t('transactions.filters.allLabels')}</SelectItem>
                    {labels.map((lbl) => (
                      <SelectItem key={lbl.id} value={lbl.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: lbl.color ?? '#6b7280' }}
                          />
                          {lbl.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status */}
            <div className="space-y-1">
              <Label>{t('transactions.filters.status')}</Label>
              <Select
                value={draft.status || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, status: v === '__all__' ? '' : v as TxStatus }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.status ? t(`transactions.status.${draft.status}`) : t('transactions.filters.allStatuses')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allStatuses')}</SelectItem>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{t(label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={resetFilters}>{t('transactions.filters.reset')}</Button>
            <Button className="flex-1" onClick={applyFilters}>{t('transactions.filters.apply')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
