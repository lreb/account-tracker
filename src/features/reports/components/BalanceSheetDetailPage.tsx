import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ArrowLeft, SlidersHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { db } from '@/db'
import { getVisibleAccounts } from '@/lib/accounts'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useLabelsStore } from '@/stores/labels.store'
import {
  BALANCE_SHEET_PRESETS,
  getAccountBalanceAtDate,
  getAccountTransactionAmount,
  isTransactionForAccount,
  type BalanceSheetPreset,
} from '@/lib/balance-sheet'
import { getTranslatedCategoryName } from '@/lib/categories'
import { formatCurrency } from '@/lib/currency'
import type { Account, Transaction } from '@/types'

import { AddFabMenu } from '@/components/ui/add-fab-menu'
import { Button } from '@/components/ui/button'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { TransactionListItem } from '@/components/ui/transaction-list-item'
import { TransactionDateGroupHeader } from '@/components/ui/transaction-date-group-header'
import { BalanceSheetDetailFiltersSheet } from './BalanceSheetDetailFiltersSheet'
import { EMPTY_FILTERS, type DetailFilters } from './balance-sheet-detail-filters.types'

function getTransactionPresentation(transaction: Transaction, account: Account) {
  const signedAmount = getAccountTransactionAmount(transaction, account)
  const absoluteAmount = Math.abs(signedAmount)

  if (transaction.type === 'transfer') {
    const isIncoming = transaction.toAccountId === account.id
    return {
      amount: absoluteAmount,
      tone: isIncoming ? 'text-green-600' : 'text-red-500',
      prefix: isIncoming ? '+' : '-',
      labelKey: isIncoming ? 'balanceSheet.transactionKinds.transferIn' : 'balanceSheet.transactionKinds.transferOut',
      currency: account.currency,
    }
  }

  return {
    amount: absoluteAmount,
    tone: signedAmount >= 0 ? 'text-green-600' : 'text-red-500',
    prefix: signedAmount >= 0 ? '+' : '-',
    labelKey: transaction.type === 'income' ? 'transactions.income' : 'transactions.expense',
    currency: transaction.currency,
  }
}

export default function BalanceSheetDetailPage() {
  const { t } = useTranslation()
  const { accountId } = useParams<{ accountId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { accounts } = useAccountsStore()
  // Reload full transaction history on every mount — TransactionListPage loads a
  // date-filtered subset into this same store, so without this the balance would
  // be wrong until the user does a full page refresh.
  const { transactions, load: loadTransactions } = useTransactionsStore()
  // allTx mirrors BalanceSheetPage: all transactions except cancelled, loaded
  // directly from Dexie so balance calculation is never affected by the store's
  // date filter or by cancelled entries.
  const [allTx, setAllTx] = useState<Transaction[]>([])
  const { categories } = useCategoriesStore()
  const { labels } = useLabelsStore()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<DetailFilters>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<DetailFilters>(EMPTY_FILTERS)
  const [draftPeriod, setDraftPeriod] = useState<BalanceSheetPreset>('endLastMonth')
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  // O(1) lookup maps
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const labelMap    = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])

  const presetParam = searchParams.get('period')
  const selectedPreset = BALANCE_SHEET_PRESETS.includes(presetParam as BalanceSheetPreset)
    ? (presetParam as BalanceSheetPreset)
    : 'endLastMonth'

  useEffect(() => { void loadTransactions() }, [loadTransactions])

  // Load ALL non-cancelled transactions directly from Dexie — same source as
  // BalanceSheetPage so both pages always produce identical balances.
  useEffect(() => {
    db.transactions
      .filter((tx) => tx.status !== 'cancelled')
      .toArray()
      .then(setAllTx)
      .catch(console.error)
  }, [transactions])

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (searchParams.get('period') !== selectedPreset) {
      const next = new URLSearchParams(searchParams)
      next.set('period', selectedPreset)
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, selectedPreset, setSearchParams])

  const openFilters = () => { setDraft(filters); setDraftPeriod(selectedPreset); setFiltersOpen(true) }
  const applyFilters = () => {
    setFilters(draft)
    const next = new URLSearchParams(searchParams)
    next.set('period', draftPeriod)
    setSearchParams(next)
    setFiltersOpen(false)
  }
  const resetFilters = () => {
    setDraft(EMPTY_FILTERS)
    setDraftPeriod('endLastMonth')
    setFilters(EMPTY_FILTERS)
    const next = new URLSearchParams(searchParams)
    next.set('period', 'endLastMonth')
    setSearchParams(next)
    setFiltersOpen(false)
  }
  const removeChip = (key: keyof DetailFilters) => setFilters((prev) => ({ ...prev, [key]: '' }))

  const account = visibleAccounts.find((item) => item.id === accountId) ?? null

  // accountTransactions: non-cancelled only — used exclusively for balance maths.
  // filteredAccountTransactions below uses the store's full `transactions` list
  // so cancelled entries remain visible in the UI with strikethrough styling.
  const accountTransactions = useMemo(() => {
    if (!account) {
      return []
    }

    return allTx
      .filter((transaction) => isTransactionForAccount(transaction, account.id))
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [account, allTx])

  const filteredAccountTransactions = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const dateFromISO = filters.dateFrom ? `${filters.dateFrom}T00:00:00.000Z` : ''
    const dateToISO   = filters.dateTo   ? `${filters.dateTo}T23:59:59.999Z`   : ''
    const all = transactions
      .filter((transaction) => isTransactionForAccount(transaction, account?.id ?? ''))
      .sort((left, right) => right.date.localeCompare(left.date))
    return all.filter((tx) => {
      if (q && !tx.description.toLowerCase().includes(q) && !(tx.notes ?? '').toLowerCase().includes(q)) return false
      if (filters.status  && tx.status !== filters.status) return false
      if (filters.labelId && !(tx.labels ?? []).includes(filters.labelId)) return false
      if (dateFromISO && tx.date < dateFromISO) return false
      if (dateToISO   && tx.date > dateToISO)   return false
      return true
    })
  }, [account, transactions, filters])

  const currentBalance = useMemo(() => {
    if (!account) {
      return 0
    }

    return getAccountBalanceAtDate(account, accountTransactions, new Date())
  }, [account, accountTransactions])

  // Running account balance after each non-cancelled transaction (for balance column in list)
  const balanceAfterTx = useMemo(() => {
    if (!account) return new Map<string, number>()
    const result = new Map<string, number>()
    // accountTransactions is newest-first; traverse oldest-first for accumulation
    let running = account.openingBalance
    const sorted = [...accountTransactions].reverse()
    for (const tx of sorted) {
      running += getAccountTransactionAmount(tx, account)
      result.set(tx.id, running)
    }
    return result
  }, [account, accountTransactions])

  type FlatItem =
    | { kind: 'header'; dateKey: string; headerLabel: string; count: number }
    | { kind: 'tx'; tx: Transaction; timeStr: string }

  const flatItems = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = []
    const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    const map = new Map<string, Transaction[]>()
    for (const tx of filteredAccountTransactions) {
      const key = tx.date.substring(0, 10)
      const arr = map.get(key)
      if (arr) arr.push(tx)
      else map.set(key, [tx])
    }
    for (const [dateKey, txs] of map) {
      const d = parseISO(dateKey)
      const headerLabel = isToday(d)
        ? t('transactions.today')
        : isYesterday(d)
          ? t('transactions.yesterday')
          : format(d, 'EEEE, MMM d, yyyy')
      result.push({ kind: 'header', dateKey, headerLabel, count: txs.length })
      for (const tx of txs) {
        result.push({ kind: 'tx', tx, timeStr: timeFormatter.format(new Date(tx.date)) })
      }
    }
    return result
  }, [filteredAccountTransactions, t])

  const overviewUrl = `/balance-sheet?period=${selectedPreset}`
  const returnTo = `/balance-sheet/${accountId}?period=${selectedPreset}`

  const activeCount = [filters.search, filters.status, filters.labelId, filters.dateFrom, filters.dateTo].filter(Boolean).length

  type FilterChip = { key: keyof DetailFilters; label: string }
  const chips: FilterChip[] = [
    filters.search   ? { key: 'search',   label: `"${filters.search}"` }                              : null,
    filters.status   ? { key: 'status',   label: t(`transactions.status.${filters.status}`) }         : null,
    filters.labelId  ? { key: 'labelId',  label: labels.find((l) => l.id === filters.labelId)?.name ?? '' } : null,
    filters.dateFrom ? { key: 'dateFrom', label: `${t('transactions.filters.dateFrom')} ${filters.dateFrom}` } : null,
    filters.dateTo   ? { key: 'dateTo',   label: `${t('transactions.filters.dateTo')} ${filters.dateTo}` }   : null,
  ].filter(Boolean) as FilterChip[]

  if (!account) {
    return (
      <div className="p-4 pb-24 space-y-4">
        <Link to={overviewUrl} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">
          <ArrowLeft size={16} />
          {t('balanceSheet.backToOverview')}
        </Link>
        <div className="rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">{t('balanceSheet.accountNotFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      <div className="space-y-3">
        <Link to={overviewUrl} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">
          <ArrowLeft size={16} />
          {t('balanceSheet.backToOverview')}
        </Link>

        <div className="rounded-3xl border bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-gray-900">{account.name}</h1>
              <p className="text-xs text-gray-500">
                {t(`accounts.types.${account.type}`)} · {account.currency}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t('balanceSheet.currentBalance')}</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(currentBalance, account.currency)}</p>
            </div>
          </div>
        </div>

      </div>

      <section className="space-y-3 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
              {t('balanceSheet.transactionsTitle')}
            </h2>
            <p className="text-xs text-gray-400">{t('balanceSheet.transactionsSubtitle', { account: account.name })}</p>
          </div>
          <button
            type="button"
            onClick={openFilters}
            className="relative flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm shrink-0"
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
          <div className="flex flex-wrap gap-1.5">
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

        {filteredAccountTransactions.length === 0 ? (
          activeCount > 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-8 text-center space-y-3">
              <p className="text-sm text-gray-500">{t('transactions.noMatch')}</p>
              <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                {t('transactions.clearFilters')}
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {t('balanceSheet.noTransactionsForAccount')}
            </p>
          )
        ) : (
          <div>
            {flatItems.map((item, i) =>
              item.kind === 'header' ? (
                <TransactionDateGroupHeader
                  key={item.dateKey}
                  headerLabel={item.headerLabel}
                  count={item.count}
                />
              ) : (() => {
                const { tx, timeStr } = item
                const cat = categoryMap.get(tx.categoryId)
                const presentation = getTransactionPresentation(tx, account)
                const resolvedLabels = (tx.labels ?? []).flatMap((lid) => {
                  const l = labelMap.get(lid)
                  return l ? [l] : []
                })
                const bal = balanceAfterTx.get(tx.id)
                return (
                  <TransactionListItem
                    key={tx.id + String(i)}
                    description={tx.description}
                    status={tx.status}
                    timeStr={timeStr}
                    categoryName={getTranslatedCategoryName(cat, t)}
                    resolvedLabels={resolvedLabels}
                    linkTo={`/transactions/${tx.id}?accountId=${encodeURIComponent(account.id)}&returnTo=${encodeURIComponent(returnTo)}`}
                    amount={presentation.amount}
                    amountPrefix={presentation.prefix}
                    amountCurrency={presentation.currency}
                    amountTone={presentation.tone}
                    primaryBalance={bal != null ? { accountName: account.name, balance: bal, currency: account.currency } : undefined}
                  />
                )
              })()
            )}
          </div>
        )}
      </section>

      <AddFabMenu />
      <ScrollToTopButton />

      <BalanceSheetDetailFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        draft={draft}
        onDraftChange={setDraft}
        draftPeriod={draftPeriod}
        onDraftPeriodChange={setDraftPeriod}
        labels={labels}
        onApply={applyFilters}
        onReset={resetFilters}
      />
    </div>
  )
}