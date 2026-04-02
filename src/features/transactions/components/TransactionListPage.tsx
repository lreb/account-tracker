import { useEffect, useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, subMonths, subYears } from 'date-fns'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLabelsStore } from '@/stores/labels.store'
import { AddFabMenu } from '@/components/ui/add-fab-menu'
import {
  getVisibleAccountIds,
  getVisibleAccounts,
  isTransactionForVisiblePrimaryAccount,
} from '@/lib/accounts'
import { getTranslatedCategoryName } from '@/lib/categories'
import { formatCurrency } from '@/lib/currency'
import type { Transaction } from '@/types'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
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

type BalanceEntry = {
  accountBalance: number
  accountCurrency: string
  toAccountBalance?: number
  toAccountCurrency?: string
}

type FlatItem =
  | { kind: 'header'; dateKey: string; headerLabel: string; count: number }
  | { kind: 'tx'; tx: Transaction; timeStr: string }

type QuickRange = 'all' | '1m' | '3m' | '6m' | '1y' | '2y'

const DEFAULT_QUICK_RANGE: QuickRange = '1y'

function getQuickRangeDateFrom(range: QuickRange): string {
  const today = new Date()
  if (range === '1m') return format(subMonths(today, 1), 'yyyy-MM-dd')
  if (range === '3m') return format(subMonths(today, 3), 'yyyy-MM-dd')
  if (range === '6m') return format(subMonths(today, 6), 'yyyy-MM-dd')
  if (range === '1y') return format(subYears(today, 1), 'yyyy-MM-dd')
  if (range === '2y') return format(subYears(today, 2), 'yyyy-MM-dd')
  return ''
}

const DEFAULT_FILTERS: Filters = {
  ...EMPTY_FILTERS,
  dateFrom: getQuickRangeDateFrom(DEFAULT_QUICK_RANGE),
}

// Persists across component mounts within the same session
let persistedFilters: Filters = { ...DEFAULT_FILTERS }

let persistedQuickRange: QuickRange = DEFAULT_QUICK_RANGE

// Map quick range value to an ISO date cutoff for DB-level filtering (undefined = load all)
function getQuickRangeSince(range: QuickRange): string | undefined {
  const today = new Date()
  if (range === '1m') return subMonths(today, 1).toISOString()
  if (range === '3m') return subMonths(today, 3).toISOString()
  if (range === '6m') return subMonths(today, 6).toISOString()
  if (range === '1y') return subYears(today, 1).toISOString()
  if (range === '2y') return subYears(today, 2).toISOString()
  return undefined
}

function getUtcStartIso(dateValue: string): string {
  return `${dateValue}T00:00:00.000Z`
}

function getUtcEndIso(dateValue: string): string {
  return `${dateValue}T23:59:59.999Z`
}

export default function TransactionListPage() {
  const { t } = useTranslation()
  const { transactions, loading, load: loadTx } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()
  const { labels, load: loadLabels } = useLabelsStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])
  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])
  // O(1) lookup maps — avoid .find() on every virtual row render (Option B)
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountMap  = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const visibleTransactions = useMemo(
    () => transactions.filter((transaction) => isTransactionForVisiblePrimaryAccount(transaction, visibleAccountIds)),
    [transactions, visibleAccountIds],
  )

  const [sheetOpen, setSheetOpen] = useState(false)
  const [filters, setFiltersRaw] = useState<Filters>(persistedFilters)
  // draft = filters being edited inside the sheet; only committed on Apply
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [quickRange, setQuickRangeRaw] = useState<QuickRange>(persistedQuickRange)

  // Keep module-level caches in sync so state survives navigation
  const setFilters = (next: Filters | ((prev: Filters) => Filters)) => {
    setFiltersRaw((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      persistedFilters = value
      return value
    })
  }
  const setQuickRange = (range: QuickRange) => {
    setQuickRangeRaw(range)
    persistedQuickRange = range
  }

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range)
    const dateFrom = getQuickRangeDateFrom(range)
    loadTx(getQuickRangeSince(range))  // push date filter into IndexedDB — only load what's needed
    setFilters((prev) => ({ ...prev, dateFrom, dateTo: '' }))
  }

  // On mount: restore the persisted quick range — push its cutoff into Dexie so only
  // the needed rows are loaded from IndexedDB (Option E).
  useEffect(() => {
    loadTx(getQuickRangeSince(persistedQuickRange))
    loadLabels()
  }, [loadTx, loadLabels])

  const openSheet = () => { setDraft(filters); setSheetOpen(true) }
  // Sheet Apply: reload DB with the custom dateFrom if set, then apply all draft filters
  const applyFilters = () => {
    setFilters(draft)
    setQuickRange('all')
    loadTx(draft.dateFrom ? getUtcStartIso(draft.dateFrom) : undefined)
    setSheetOpen(false)
  }
  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    setQuickRange(DEFAULT_QUICK_RANGE)
    loadTx(getQuickRangeSince(DEFAULT_QUICK_RANGE))
    setSheetOpen(false)
  }
  const removeChip = (key: keyof Filters) => {
    if (key === 'dateFrom') {
      setQuickRange('all')
      loadTx()  // lower bound removed — reload full dataset from DB
    } else if (key === 'dateTo') {
      setQuickRange('all')  // dateTo is JS-only; no DB reload needed
    }
    setFilters((prev) => ({ ...prev, [key]: '' }))
  }

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const dateFromISO = filters.dateFrom ? getUtcStartIso(filters.dateFrom) : ''
    const dateToISO = filters.dateTo ? getUtcEndIso(filters.dateTo) : ''
    return visibleTransactions.filter((tx) => {
      if (q && !tx.description.toLowerCase().includes(q) && !(tx.notes ?? '').toLowerCase().includes(q)) return false
      if (filters.type && tx.type !== filters.type) return false
      if (filters.categoryId && tx.categoryId !== filters.categoryId) return false
      if (filters.accountId && tx.accountId !== filters.accountId) return false
      if (filters.labelId && !(tx.labels ?? []).includes(filters.labelId)) return false
      if (filters.status && tx.status !== filters.status) return false
      if (dateFromISO && tx.date < dateFromISO) return false
      if (dateToISO  && tx.date > dateToISO)   return false
      return true
    })
  }, [visibleTransactions, filters])

  // Compute running account balance at the time of every transaction.
  // This is intentionally independent of `filtered` so that applied filters (type,
  // category, account, label, status, date range) never alter the displayed balance —
  // the value always reflects the true account balance at the moment each transaction
  // was recorded, regardless of what is currently shown in the list.
  const balanceAfterTx = useMemo(() => {
    const accBalances = new Map<string, number>()
    for (let i = 0; i < visibleAccounts.length; i++) accBalances.set(visibleAccounts[i].id, visibleAccounts[i].openingBalance)

    const result = new Map<string, BalanceEntry>()

    for (let i = visibleTransactions.length - 1; i >= 0; i--) {
      const tx = visibleTransactions[i]
      const bal = accBalances.get(tx.accountId) ?? 0

      if (tx.type === 'income') {
        accBalances.set(tx.accountId, bal + tx.amount)
      } else if (tx.type === 'expense') {
        accBalances.set(tx.accountId, bal - tx.amount)
      } else if (tx.type === 'transfer') {
        accBalances.set(tx.accountId, bal - tx.amount)
        if (tx.toAccountId) {
          const destBal = accBalances.get(tx.toAccountId) ?? 0
          accBalances.set(tx.toAccountId, destBal + (tx.originalAmount ?? tx.amount))
        }
      }

      const acc = accountMap.get(tx.accountId)
      const entry: BalanceEntry = {
        accountBalance: accBalances.get(tx.accountId) ?? 0,
        accountCurrency: acc?.currency ?? tx.currency ?? baseCurrency,
      }
      if (tx.type === 'transfer' && tx.toAccountId) {
        const toAcc = accountMap.get(tx.toAccountId)
        entry.toAccountBalance = accBalances.get(tx.toAccountId)
        entry.toAccountCurrency = toAcc?.currency ?? baseCurrency
      }
      result.set(tx.id, entry)
    }
    return result
  }, [visibleTransactions, visibleAccounts, accountMap, baseCurrency])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const tx of filtered) {
      const key = tx.date.substring(0, 10)
      const arr = map.get(key)
      if (arr) arr.push(tx)
      else map.set(key, [tx])
    }
    return Array.from(map.entries()).map(([dateKey, txs]) => ({ dateKey, txs }))
  }, [filtered])

  // Flatten grouped data and precompute all display strings once.
  // Best practice: parse ISO strings to Date objects once per item, reuse the result —
  // never call parseISO() inside the virtual row renderer.
  const flatItems = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = []
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })

    for (const { dateKey, txs } of grouped) {
      const d = parseISO(dateKey)
      const headerLabel = isToday(d)
        ? t('transactions.today')
        : isYesterday(d)
          ? t('transactions.yesterday')
          : format(d, 'EEEE, MMM d, yyyy')
      result.push({ kind: 'header', dateKey, headerLabel, count: txs.length })
      for (const tx of txs) {
        // format via Intl vs massive date-fns string parsing
        result.push({ kind: 'tx', tx, timeStr: timeFormatter.format(new Date(tx.date)) })
      }
    }
    return result
  }, [grouped, t])

  const activeCount = Object.values(filters).filter(Boolean).length

  // ── Virtual list ────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollContainerRef.current,
    // header rows are ~40 px; tx rows ~88 px (more with label badges)
    estimateSize: (i) => (flatItems[i]?.kind === 'header' ? 40 : 88),
    overscan: 5,
    // auto-measure actual DOM heights so variable-height rows (labels) are correct
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  const chips: { key: keyof Filters; label: string }[] = [
    filters.search    ? { key: 'search',     label: `"${filters.search}"` }                                              : null,
    filters.type      ? { key: 'type',        label: t(`transactions.${filters.type}`) }                                 : null,
    filters.categoryId? { key: 'categoryId',  label: getTranslatedCategoryName(categories.find((c) => c.id === filters.categoryId), t) }   : null,
    filters.accountId ? { key: 'accountId',   label: accounts.find((a) => a.id === filters.accountId)?.name ?? '' }      : null,
    filters.labelId   ? { key: 'labelId',      label: labels.find((l) => l.id === filters.labelId)?.name ?? '' }           : null,
    filters.status    ? { key: 'status',      label: t(`transactions.status.${filters.status}`) }                        : null,
    filters.dateFrom  ? { key: 'dateFrom',    label: `From ${filters.dateFrom}` }                                        : null,
    filters.dateTo    ? { key: 'dateTo',      label: `To ${filters.dateTo}` }                                            : null,
  ].filter(Boolean) as { key: keyof Filters; label: string }[]

  return (
    // h-full + overflow-hidden gives this page a bounded height equal to <main>.
    // The scroll happens inside the list container below, not on <main> itself.
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Non-scrolling header ──────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4">
        {/* Quick date range pills */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none">
          {([
            { value: 'all', label: t('transactions.quickRange.all') },
            { value: '1m',  label: t('transactions.quickRange.lastMonth') },
            { value: '3m',  label: t('transactions.quickRange.lastQuarter') },
            { value: '6m',  label: t('transactions.quickRange.last6Months') },
            { value: '1y',  label: t('transactions.quickRange.lastYear') },
            { value: '2y',  label: t('transactions.quickRange.last2Years') },
          ] as { value: QuickRange; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => applyQuickRange(value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                quickRange === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">{t('transactions.title')}</h1>
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
      </div>

      {/* ── Scrollable list area (owns the scroll; <main> won't scroll) ──── */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
        {loading && visibleTransactions.length === 0 ? (
          <div className="space-y-3 mt-2" aria-label="Loading transactions">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[72px] rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : visibleTransactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-12">
            {t('transactions.noTransactions')}
          </p>
        ) : filtered.length === 0 ? (
          <div className="text-center mt-12 space-y-2">
            <p className="text-sm text-gray-400">{t('transactions.noMatch')}</p>
            <Button variant="outline" size="sm" onClick={resetFilters}>{t('transactions.clearFilters')}</Button>
          </div>
        ) : (
          // Virtual list: total height reserves scroll space; only visible rows are in the DOM
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = flatItems[virtualRow.index]
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {item.kind === 'header' ? (
                    <div className="flex items-center justify-between pt-3 pb-2 px-1">
                      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {item.headerLabel}
                      </h2>
                      <span className="text-xs text-gray-400">
                        {item.count} {item.count === 1 ? t('transactions.record') : t('transactions.records')}
                      </span>
                    </div>
                  ) : (() => {
                    const { tx, timeStr } = item
                    const cat   = categoryMap.get(tx.categoryId)
                    const acc   = accountMap.get(tx.accountId)
                    const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined
                    const bal   = balanceAfterTx.get(tx.id)
                    return (
                      <div className="pb-2">
                        <Link
                          to={`/transactions/${tx.id}`}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                            tx.status === 'cancelled'
                              ? 'bg-gray-50 border-gray-200 opacity-60'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${tx.status === 'cancelled' ? 'line-through text-gray-400' : ''}`}>{tx.description}</p>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <p className="text-xs text-gray-400 truncate">{getTranslatedCategoryName(cat, t) || '—'}</p>
                              <p className="text-xs text-gray-400 truncate">{acc?.name ?? '—'}</p>
                              <p className="text-xs text-gray-400">{timeStr}</p>
                            </div>
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
                              tx.status === 'cancelled' ? 'text-gray-400 line-through' :
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
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ScrollToTopButton scrollRef={scrollContainerRef} threshold={320} />

      {/* ── FAB: Add menu (right side) ────────────────────────────────────── */}
      <AddFabMenu />

      {/* Filter sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-5 pt-2 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>{t('transactions.filters.title')}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
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
                onValueChange={(v) => setDraft((p) => ({ ...p, categoryId: v === '__all__' ? '' : (v ?? '') }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.categoryId
                      ? getTranslatedCategoryName(categories.find((c) => c.id === draft.categoryId), t)
                      : t('transactions.filters.allCategories')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allCategories')}</SelectItem>
                  {categories.filter((cat) => !cat.deletedAt).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{getTranslatedCategoryName(cat, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account */}
            <div className="space-y-1">
              <Label>{t('transactions.filters.account')}</Label>
              <Select
                value={draft.accountId || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, accountId: v === '__all__' ? '' : (v ?? '') }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.accountId ? accounts.find((a) => a.id === draft.accountId)?.name : t('transactions.filters.allAccounts')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allAccounts')}</SelectItem>
                  {visibleAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className={acc.cancelled ? 'text-gray-400' : undefined}>
                        {acc.name}{acc.cancelled ? ` (${t('accounts.cancelled')})` : ''}
                      </span>
                    </SelectItem>
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
                  onValueChange={(v) => setDraft((p) => ({ ...p, labelId: v === '__all__' ? '' : (v ?? '') }))}
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
