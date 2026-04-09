import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ArrowLeft, ChevronDown, Fuel, Plus, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { db } from '@/db'
import { getVisibleAccounts } from '@/lib/accounts'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
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

import { LabelPickerButton } from '@/components/ui/label-picker-button'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { TransactionListItem } from '@/components/ui/transaction-list-item'
import { TransactionDateGroupHeader } from '@/components/ui/transaction-date-group-header'

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
  const { vehicles } = useVehiclesStore()
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
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
    const all = transactions
      .filter((transaction) => isTransactionForAccount(transaction, account?.id ?? ''))
      .sort((left, right) => right.date.localeCompare(left.date))
    return filterLabelIds.length === 0
      ? all
      : all.filter((t) => filterLabelIds.some((id) => t.labels?.includes(id)))
  }, [account, transactions, filterLabelIds])

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

  const activeVehicles = useMemo(() => vehicles.filter((v) => !v.archivedAt), [vehicles])

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const overviewUrl = `/balance-sheet?period=${selectedPreset}`
  const returnTo = `/balance-sheet/${accountId}?period=${selectedPreset}`

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

        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{account.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t(`accounts.types.${account.type}`)} · {account.currency}
              </p>

            </div>
            <div ref={addMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAddMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-full bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium"
              >
                <Plus size={14} />
                {t('common.add')}
                <ChevronDown size={12} className={`transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border bg-white shadow-lg z-50 py-1">
                  <Link
                    to={`/transactions/new?accountId=${encodeURIComponent(account.id)}&returnTo=${encodeURIComponent(returnTo)}`}
                    onClick={() => setAddMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <Plus size={14} className="text-gray-500" />
                    {t('transactions.addTransaction')}
                  </Link>
                  {activeVehicles.length > 0 && (
                    <>
                      {activeVehicles.length === 1 ? (
                        <>
                          <Link
                            to={`/vehicles/${activeVehicles[0].id}/fuel/new?returnTo=${encodeURIComponent(returnTo)}`}
                            onClick={() => setAddMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            <Fuel size={14} className="text-gray-500" />
                            {t('vehicles.addFuelLog')}
                          </Link>
                          <Link
                            to={`/vehicles/${activeVehicles[0].id}/service/new?returnTo=${encodeURIComponent(returnTo)}`}
                            onClick={() => setAddMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            <Wrench size={14} className="text-gray-500" />
                            {t('vehicles.addService')}
                          </Link>
                        </>
                      ) : (
                        activeVehicles.map((v) => (
                          <div key={v.id}>
                            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              {v.name}
                            </div>
                            <Link
                              to={`/vehicles/${v.id}/fuel/new?returnTo=${encodeURIComponent(returnTo)}`}
                              onClick={() => setAddMenuOpen(false)}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                            >
                              <Fuel size={14} className="text-gray-500" />
                              {t('vehicles.addFuelLog')}
                            </Link>
                            <Link
                              to={`/vehicles/${v.id}/service/new?returnTo=${encodeURIComponent(returnTo)}`}
                              onClick={() => setAddMenuOpen(false)}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
                            >
                              <Wrench size={14} className="text-gray-500" />
                              {t('vehicles.addService')}
                            </Link>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{t('balanceSheet.currentBalance')}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(currentBalance, account.currency)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {BALANCE_SHEET_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('period', preset)
                setSearchParams(next)
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedPreset === preset
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {t(`balanceSheet.periods.${preset}`)}
            </button>
          ))}
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
          <LabelPickerButton labels={labels} selectedIds={filterLabelIds} onChange={setFilterLabelIds} />
        </div>

        {filteredAccountTransactions.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            {t('balanceSheet.noTransactionsForAccount')}
          </p>
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
      <ScrollToTopButton />
    </div>
  )
}