import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, X } from 'lucide-react'
import { format, subMonths, subYears } from 'date-fns'
import { useVirtualizer } from '@tanstack/react-virtual'

import { useGroupedTransactions } from '@/features/transactions/hooks/useGroupedTransactions'
import type { FlatTransactionItem } from '@/features/transactions/hooks/useGroupedTransactions'
import { useCategoriesStore } from '@/stores/categories.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLabelsStore } from '@/stores/labels.store'
import { getTranslatedCategoryName } from '@/lib/categories'
import { getVisibleAccounts } from '@/lib/accounts'
import type { Transaction } from '@/types'

import { AddFabMenu } from '@/components/ui/add-fab-menu'
import { TransactionListItem } from '@/components/ui/transaction-list-item'
import { TransactionDateGroupHeader } from '@/components/ui/transaction-date-group-header'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { ComputingOverlay } from '@/components/ui/computing-overlay'
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

import {
  type TransactionListFilters,
  type TxRunningBalance,
  type TxListQuickRange,
  type TxListType,
  type TxListStatus,
  EMPTY_TX_LIST_FILTERS,
  DEFAULT_TX_LIST_QUICK_RANGE,
} from './transaction-list.types'

// ── Internal constants ───────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: TxListType; label: string }[] = [
  { value: 'expense',  label: 'transactions.expense' },
  { value: 'income',   label: 'transactions.income' },
  { value: 'transfer', label: 'transactions.transfer' },
]

const STATUS_OPTIONS: { value: TxListStatus; label: string }[] = [
  { value: 'cleared',    label: 'transactions.status.cleared' },
  { value: 'pending',    label: 'transactions.status.pending' },
  { value: 'reconciled', label: 'transactions.status.reconciled' },
  { value: 'cancelled',  label: 'transactions.status.cancelled' },
]

function getQuickRangeDateFrom(range: TxListQuickRange): string {
  const today = new Date()
  if (range === '1m') return format(subMonths(today, 1), 'yyyy-MM-dd')
  if (range === '3m') return format(subMonths(today, 3), 'yyyy-MM-dd')
  if (range === '6m') return format(subMonths(today, 6), 'yyyy-MM-dd')
  if (range === '1y') return format(subYears(today, 1), 'yyyy-MM-dd')
  if (range === '2y') return format(subYears(today, 2), 'yyyy-MM-dd')
  return ''
}

function getQuickRangeSince(range: TxListQuickRange): string | undefined {
  const today = new Date()
  if (range === '1m') return subMonths(today, 1).toISOString()
  if (range === '3m') return subMonths(today, 3).toISOString()
  if (range === '6m') return subMonths(today, 6).toISOString()
  if (range === '1y') return subYears(today, 1).toISOString()
  if (range === '2y') return subYears(today, 2).toISOString()
  return undefined
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TransactionListProps {
  /** Transaction pool — caller controls visibility and account scoping. */
  transactions: Transaction[]
  loading?: boolean

  /**
   * Where the FAB "Add transaction" and edit links navigate back to after save/cancel.
   * Defaults to '/transactions'.
   */
  returnTo?: string

  /**
   * Filters that are always applied AND hidden from the filter sheet UI.
   * Use to scope the list to a specific category, account, label, etc.
   */
  lockedFilters?: Partial<TransactionListFilters>

  /**
   * Seed the internal filter state on first mount (e.g., from persisted or URL-based filters).
   * After mount, the component owns this state.
   */
  initialFilters?: TransactionListFilters

  /**
   * Fired whenever the user applies or resets filters — use for session persistence.
   */
  onFiltersChange?: (f: TransactionListFilters) => void

  /**
   * When true, shows Quick Range shortcut pills inside the filter sheet.
   * Requires onLoadRange to be wired up so the caller can reload from DB.
   */
  showQuickRangePicker?: boolean

  /** Seed the quick-range selection on first mount. */
  initialQuickRange?: TxListQuickRange

  /** Fired when the quick range selection changes — use for session persistence. */
  onQuickRangeChange?: (qr: TxListQuickRange) => void

  /**
   * Called when the applied date range may require a DB reload.
   * Receives an ISO lower-bound to pass to loadTx(), or undefined for "load all".
   */
  onLoadRange?: (since: string | undefined) => void

  /** Per-transaction running balance data. When omitted, balance rows are hidden. */
  balanceMap?: Map<string, TxRunningBalance>

  /**
   * Override per-transaction amount presentation.
   * When omitted, standard income/expense/transfer coloring and prefix are used.
   */
  getAmountProps?: (tx: Transaction) => {
    amount: number
    prefix: string
    amountCurrency: string
  }

  /**
   * 'page'     – Component owns the scroll container and uses a virtual list.
   *              Use when TransactionList IS the page (full-height layout).
   * 'embedded' – Plain list; no own scroll container.
   *              Use when TransactionList is a section inside a larger page.
   * Default: 'embedded'
   */
  layout?: 'page' | 'embedded'

  /**
   * Seed the scroll position on first mount (session persistence).
   * Only used when layout='page'.
   */
  initialScrollOffset?: number

  /**
   * Fired on every scroll event — use to persist the offset for restoration.
   * Only relevant when layout='page'.
   */
  onScrollChange?: (offset: number) => void

  /**
   * Extra content rendered at the very top of the filter sheet, before the standard controls.
   * Use for context-specific filters (e.g., a balance-sheet period picker).
   */
  filterSheetExtraSection?: ReactNode

  /** Override the empty-state message shown when transactions is empty. */
  emptyMessage?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransactionList({
  transactions,
  loading = false,
  returnTo = '/transactions',
  lockedFilters = {},
  initialFilters,
  onFiltersChange,
  showQuickRangePicker = false,
  initialQuickRange,
  onQuickRangeChange,
  onLoadRange,
  balanceMap,
  getAmountProps,
  layout = 'embedded',
  filterSheetExtraSection,
  emptyMessage,
  initialScrollOffset,
  onScrollChange,
}: TransactionListProps) {
  const { t } = useTranslation()
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()
  const { labels } = useLabelsStore()

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountMap  = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const labelMap    = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  // ── Filter state ──────────────────────────────────────────────────────────

  const defaultFilters: TransactionListFilters = useMemo(() =>
    showQuickRangePicker
      ? { ...EMPTY_TX_LIST_FILTERS, dateFrom: getQuickRangeDateFrom(DEFAULT_TX_LIST_QUICK_RANGE) }
      : EMPTY_TX_LIST_FILTERS,
  [showQuickRangePicker])

  const [filters, setFiltersInternal] = useState<TransactionListFilters>(
    initialFilters ?? defaultFilters,
  )
  const [draft, setDraft] = useState<TransactionListFilters>(EMPTY_TX_LIST_FILTERS)
  const [quickRange, setQuickRangeInternal] = useState<TxListQuickRange>(
    initialQuickRange ?? DEFAULT_TX_LIST_QUICK_RANGE,
  )
  const [draftQuickRange, setDraftQuickRange] = useState<TxListQuickRange>(
    initialQuickRange ?? DEFAULT_TX_LIST_QUICK_RANGE,
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  const setFilters = (next: TransactionListFilters | ((prev: TransactionListFilters) => TransactionListFilters)) => {
    setFiltersInternal((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      onFiltersChange?.(value)
      return value
    })
  }

  const setQuickRange = (qr: TxListQuickRange) => {
    setQuickRangeInternal(qr)
    onQuickRangeChange?.(qr)
  }

  const isLocked = (key: keyof TransactionListFilters): boolean => key in lockedFilters

  function openSheet() {
    setDraft(filters)
    setDraftQuickRange(quickRange)
    setSheetOpen(true)
  }

  function applyFilters() {
    setFilters(draft)
    setQuickRange(draftQuickRange)
    onLoadRange?.(draft.dateFrom ? `${draft.dateFrom}T00:00:00.000Z` : undefined)
    setSheetOpen(false)
  }

  function resetFilters() {
    setDraft(defaultFilters)
    setFilters(defaultFilters)
    setDraftQuickRange(DEFAULT_TX_LIST_QUICK_RANGE)
    setQuickRange(DEFAULT_TX_LIST_QUICK_RANGE)
    onLoadRange?.(showQuickRangePicker ? getQuickRangeSince(DEFAULT_TX_LIST_QUICK_RANGE) : undefined)
    setSheetOpen(false)
  }

  function removeChip(key: keyof TransactionListFilters) {
    if (key === 'dateFrom') {
      setQuickRange('all')
      onLoadRange?.(undefined)
    } else if (key === 'dateTo') {
      setQuickRange('all')
    }
    setFilters((prev) => ({ ...prev, [key]: '' }))
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q          = filters.search.trim().toLowerCase()
    const dateFromISO = filters.dateFrom ? `${filters.dateFrom}T00:00:00.000Z` : ''
    const dateToISO   = filters.dateTo   ? `${filters.dateTo}T23:59:59.999Z`   : ''

    const effectiveType       = filters.type       || (lockedFilters.type       ?? '')
    const effectiveCategoryId = filters.categoryId || (lockedFilters.categoryId ?? '')
    const effectiveAccountId  = filters.accountId  || (lockedFilters.accountId  ?? '')
    const effectiveLabelId    = filters.labelId    || (lockedFilters.labelId    ?? '')
    const effectiveStatus     = filters.status     || (lockedFilters.status     ?? '')

    return transactions.filter((tx) => {
      if (q && !tx.description.toLowerCase().includes(q) && !(tx.notes ?? '').toLowerCase().includes(q)) return false
      if (effectiveType       && tx.type !== effectiveType)                                               return false
      if (effectiveCategoryId && tx.categoryId !== effectiveCategoryId)                                  return false
      if (effectiveAccountId  && tx.accountId !== effectiveAccountId && tx.toAccountId !== effectiveAccountId) return false
      if (effectiveLabelId    && !(tx.labels ?? []).includes(effectiveLabelId))                          return false
      if (effectiveStatus     && tx.status !== effectiveStatus)                                          return false
      if (dateFromISO         && tx.date < dateFromISO)                                                  return false
      if (dateToISO           && tx.date > dateToISO)                                                    return false
      return true
    })
  }, [transactions, filters, lockedFilters])

  const flatItems = useGroupedTransactions(filtered)

  // ── Filter chips ──────────────────────────────────────────────────────────

  const chips = useMemo((): { key: keyof TransactionListFilters; label: string }[] => [
    !('search'     in lockedFilters) && filters.search     ? { key: 'search',     label: `"${filters.search}"` }                                                                      : null,
    !('type'       in lockedFilters) && filters.type       ? { key: 'type',       label: t(`transactions.${filters.type}`) }                                                          : null,
    !('categoryId' in lockedFilters) && filters.categoryId ? { key: 'categoryId', label: getTranslatedCategoryName(categories.find((c) => c.id === filters.categoryId), t) }          : null,
    !('accountId'  in lockedFilters) && filters.accountId  ? { key: 'accountId',  label: accounts.find((a) => a.id === filters.accountId)?.name ?? '' }                               : null,
    !('labelId'    in lockedFilters) && filters.labelId    ? { key: 'labelId',    label: labels.find((l) => l.id === filters.labelId)?.name ?? '' }                                   : null,
    !('status'     in lockedFilters) && filters.status     ? { key: 'status',     label: t(`transactions.status.${filters.status}`) }                                                 : null,
    !('dateFrom'   in lockedFilters) && filters.dateFrom   ? { key: 'dateFrom',   label: `${t('transactions.filters.dateFrom')} ${filters.dateFrom}` }                                : null,
    !('dateTo'     in lockedFilters) && filters.dateTo     ? { key: 'dateTo',     label: `${t('transactions.filters.dateTo')} ${filters.dateTo}` }                                    : null,
  ].filter(Boolean) as { key: keyof TransactionListFilters; label: string }[], [
    filters, lockedFilters, categories, accounts, labels, t,
  ])

  const activeCount = chips.length

  // ── Item renderer (shared between virtual and plain layout) ──────────────

  function renderFlatItem(item: FlatTransactionItem): ReactNode {
    if (item.kind === 'header') {
      return (
        <TransactionDateGroupHeader
          key={item.dateKey}
          headerLabel={item.headerLabel}
          count={item.count}
        />
      )
    }

    const { tx, timeStr } = item
    const cat    = categoryMap.get(tx.categoryId)
    const toAcc  = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined
    const bal    = balanceMap?.get(tx.id)
    const resolvedLabels = (tx.labels ?? []).flatMap((lid) => {
      const l = labelMap.get(lid)
      return l ? [l] : []
    })

    const amountProps = getAmountProps
      ? getAmountProps(tx)
      : {
          amount:         tx.amount,
          prefix:         tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '',
          amountCurrency: tx.currency ?? baseCurrency,
        }

    // Propagate returnTo into edit links so the form returns to the right context.
    const editLink = returnTo !== '/transactions'
      ? `/transactions/${tx.id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/transactions/${tx.id}`

    return (
      <TransactionListItem
        key={tx.id}
        description={tx.description}
        notes={tx.notes}
        status={tx.status}
        timeStr={timeStr}
        categoryName={getTranslatedCategoryName(cat, t)}
        resolvedLabels={resolvedLabels}
        linkTo={editLink}
        amount={amountProps.amount}
        amountPrefix={amountProps.prefix}
        amountCurrency={amountProps.amountCurrency}
        txType={tx.type}
        primaryBalance={
          bal != null
            ? { accountName: accountMap.get(tx.accountId)?.name ?? '', balance: bal.accountBalance, currency: bal.accountCurrency }
            : undefined
        }
        secondaryBalance={
          tx.type === 'transfer' && bal?.toAccountBalance != null && bal.toAccountCurrency
            ? { accountName: toAcc?.name ?? '', balance: bal.toAccountBalance, currency: bal.toAccountCurrency }
            : undefined
        }
      />
    )
  }

  // ── Virtual list (page layout) ─────────────────────────────────────────────

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollRestoredRef = useRef(false)

  // Restore persisted scroll offset once the list has content.
  // Uses requestAnimationFrame so the virtualizer's own scroll listener is
  // guaranteed to be attached before we set scrollTop.
  useEffect(() => {
    if (layout !== 'page' || scrollRestoredRef.current) return
    if (!initialScrollOffset || flatItems.length === 0) return
    const el = scrollContainerRef.current
    if (!el) return
    const frame = requestAnimationFrame(() => {
      el.scrollTop = initialScrollOffset
      scrollRestoredRef.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [layout, initialScrollOffset, flatItems.length])

  const rowVirtualizer = useVirtualizer({
    count: layout === 'page' ? flatItems.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (i) => (flatItems[i]?.kind === 'header' ? 40 : 88),
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  // ── Filter sheet ──────────────────────────────────────────────────────────

  const filterSheet = (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-5 pt-2 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('transactions.filters.title')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {filterSheetExtraSection}

          {/* Quick range pills */}
          {showQuickRangePicker && (
            <div className="space-y-1">
              <Label>{t('transactions.filters.period')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'all', label: t('transactions.quickRange.all') },
                  { value: '1m',  label: t('transactions.quickRange.lastMonth') },
                  { value: '3m',  label: t('transactions.quickRange.lastQuarter') },
                  { value: '6m',  label: t('transactions.quickRange.last6Months') },
                  { value: '1y',  label: t('transactions.quickRange.lastYear') },
                  { value: '2y',  label: t('transactions.quickRange.last2Years') },
                ] as { value: TxListQuickRange; label: string }[]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDraftQuickRange(value)
                      setDraft((p) => ({ ...p, dateFrom: getQuickRangeDateFrom(value), dateTo: '' }))
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      draftQuickRange === value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keyword */}
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
                onChange={(e) => {
                  setDraft((p) => ({ ...p, dateFrom: e.target.value }))
                  if (showQuickRangePicker) setDraftQuickRange('all')
                }}
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

          {/* Type (hidden if locked) */}
          {!isLocked('type') && (
            <div className="space-y-1">
              <Label>{t('transactions.filters.type')}</Label>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
                {[{ value: '' as const, label: 'transactions.filters.all' }, ...TYPE_OPTIONS].map(({ value, label }) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, type: value as TransactionListFilters['type'] }))}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      draft.type === value ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category (hidden if locked) */}
          {!isLocked('categoryId') && (
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
          )}

          {/* Account (hidden if locked) */}
          {!isLocked('accountId') && (
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
          )}

          {/* Label (hidden if locked) */}
          {!isLocked('labelId') && labels.length > 0 && (
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

          {/* Status (hidden if locked) */}
          {!isLocked('status') && (
            <div className="space-y-1">
              <Label>{t('transactions.filters.status')}</Label>
              <Select
                value={draft.status || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, status: v === '__all__' ? '' : v as TxListStatus }))}
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
          )}
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={resetFilters}>{t('transactions.filters.reset')}</Button>
          <Button className="flex-1" onClick={applyFilters}>{t('transactions.filters.apply')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )

  // ── Filter bar (button + active chips) ────────────────────────────────────

  const filterBar = (
    <div className="shrink-0">
      <div className="flex items-center justify-end mb-2">
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
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
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
              onClick={() => setFilters(EMPTY_TX_LIST_FILTERS)}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
            >
              {t('transactions.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  )

  // ── Page layout (virtual list + own scroll container) ─────────────────────

  if (layout === 'page') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ComputingOverlay visible={loading && transactions.length > 0} />

        {/* Static header: title + filter button + chips */}
        <div className="shrink-0 px-4 pt-4">
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
                  onClick={() => setFilters(EMPTY_TX_LIST_FILTERS)}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
                >
                  {t('transactions.clearAll')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable virtual list */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-24"
          onScroll={onScrollChange ? (e) => onScrollChange(e.currentTarget.scrollTop) : undefined}
        >
          {loading && transactions.length === 0 ? (
            <div className="space-y-3 mt-2" aria-label="Loading transactions">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[72px] rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-12">
              {emptyMessage ?? t('transactions.noTransactions')}
            </p>
          ) : filtered.length === 0 ? (
            <div className="text-center mt-12 space-y-2">
              <p className="text-sm text-gray-400">{t('transactions.noMatch')}</p>
              <Button variant="outline" size="sm" onClick={resetFilters}>{t('transactions.clearFilters')}</Button>
            </div>
          ) : (
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
                    {renderFlatItem(item)}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <ScrollToTopButton scrollRef={scrollContainerRef} threshold={320} />
        <AddFabMenu returnTo={returnTo} />
        {filterSheet}
      </div>
    )
  }

  // ── Embedded layout (plain list inside parent scroll) ─────────────────────

  return (
    <div className="space-y-2">
      {filterBar}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[72px] rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {emptyMessage ?? t('transactions.noTransactions')}
        </p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-gray-400">{t('transactions.noMatch')}</p>
          <Button variant="outline" size="sm" onClick={resetFilters}>{t('transactions.clearFilters')}</Button>
        </div>
      ) : (
        <div>{flatItems.map((item) => renderFlatItem(item))}</div>
      )}

      {filterSheet}
    </div>
  )
}
