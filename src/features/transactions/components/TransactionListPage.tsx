import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subMonths, subYears } from 'date-fns'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useLabelsStore } from '@/stores/labels.store'
import {
  getVisibleAccountIds,
  getVisibleAccounts,
  isTransactionForVisiblePrimaryAccount,
} from '@/lib/accounts'
import { getAccountBalanceAtDate } from '@/lib/balance-sheet'
import type { Transaction } from '@/types'
import { db } from '@/db'
import { TransactionList } from './TransactionList'
import DueRemindersSection from '@/features/reminders/components/DueRemindersSection'
import {
  EMPTY_TX_LIST_FILTERS,
  DEFAULT_TX_LIST_QUICK_RANGE,
  type TransactionListFilters,
  type TxListQuickRange,
  type TxRunningBalance,
} from './transaction-list.types'

// ── Quick-range DB cutoff helper ──────────────────────────────────────────────

function getQuickRangeSince(range: TxListQuickRange): string | undefined {
  const today = new Date()
  if (range === '1m') return subMonths(today, 1).toISOString()
  if (range === '3m') return subMonths(today, 3).toISOString()
  if (range === '6m') return subMonths(today, 6).toISOString()
  if (range === '1y') return subYears(today, 1).toISOString()
  if (range === '2y') return subYears(today, 2).toISOString()
  return undefined
}

// Persists filter, quick-range, and scroll position across component mounts (same session).
// undefined means "no saved state" — TransactionList will use its own default.
let persistedFilters: TransactionListFilters | undefined = undefined
let persistedQuickRange: TxListQuickRange = DEFAULT_TX_LIST_QUICK_RANGE
let persistedScrollOffset: number = 0

export default function TransactionListPage() {
  const { transactions, loading, load: loadTx } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { load: loadLabels } = useLabelsStore()

  const visibleAccountIds = useMemo(() => getVisibleAccountIds(accounts), [accounts])
  const visibleAccounts   = useMemo(() => getVisibleAccounts(accounts), [accounts])
  const accountMap        = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const visibleTransactions = useMemo(
    () => transactions.filter((tx) => isTransactionForVisiblePrimaryAccount(tx, visibleAccountIds)),
    [transactions, visibleAccountIds],
  )

  const [searchParams] = useSearchParams()

  // ── Seed initial filter + quick-range state from URL params or session ────

  const [initialFilters] = useState<TransactionListFilters | undefined>(() => {
    const urlCategoryId = searchParams.get('categoryId')
    const urlDateFrom   = searchParams.get('dateFrom')
    const urlDateTo     = searchParams.get('dateTo')
    if (urlCategoryId || urlDateFrom || urlDateTo) {
      return {
        ...EMPTY_TX_LIST_FILTERS,
        categoryId: urlCategoryId ?? '',
        dateFrom:   urlDateFrom   ?? '',
        dateTo:     urlDateTo     ?? '',
      }
    }
    // May be undefined on first visit — TransactionList will use its own default
    return persistedFilters
  })

  const [initialQuickRange] = useState<TxListQuickRange>(() => {
    const hasUrlParams =
      searchParams.get('categoryId') || searchParams.get('dateFrom') || searchParams.get('dateTo')
    return hasUrlParams ? 'all' : persistedQuickRange
  })

  // returnTo propagated into the FAB + edit links so another page can be the
  // return destination (e.g. navigating here from a budget card with &returnTo=%2Fbudgets)
  const listReturnTo = useMemo(() => {
    const raw = searchParams.get('returnTo')
    return raw?.startsWith('/') ? raw : '/transactions'
  }, [searchParams])

  // ── Full Dexie load for accurate running balance computation ──────────────
  // Uses ALL non-cancelled transactions regardless of the store's date filter,
  // so the balance next to the most-recent transaction matches BalanceSheetPage.

  const [allTx, setAllTx] = useState<Transaction[]>([])
  useEffect(() => {
    db.transactions
      .filter((tx) => tx.status !== 'cancelled')
      .toArray()
      .then(setAllTx)
      .catch(console.error)
  }, [transactions])

  // ── Mount: load transaction slice and labels ──────────────────────────────

  useEffect(() => {
    loadTx(getQuickRangeSince(initialQuickRange))
    loadLabels()
    // initialQuickRange is a stable useState seed (never changes after mount).
    // Subsequent DB reloads go through the onLoadRange callback on TransactionList.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTx, loadLabels])

  // ── Running balance per transaction ──────────────────────────────────────

  const allTxByAccount = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    const push = (id: string, tx: Transaction) => {
      const list = map.get(id)
      if (list) list.push(tx)
      else map.set(id, [tx])
    }
    for (const tx of allTx) {
      push(tx.accountId, tx)
      if (tx.toAccountId) push(tx.toAccountId, tx)
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.date.localeCompare(a.date))
    }
    return map
  }, [allTx])

  const balanceAfterTx = useMemo(() => {
    const result = new Map<string, TxRunningBalance>()

    for (const acc of visibleAccounts) {
      const accTxns = allTxByAccount.get(acc.id) ?? []
      let running = getAccountBalanceAtDate(acc, accTxns, new Date())

      for (const tx of accTxns) {
        if (tx.accountId === acc.id) {
          const entry: TxRunningBalance = {
            accountBalance:  running,
            accountCurrency: acc.currency,
          }
          if (tx.type === 'transfer' && tx.toAccountId) {
            const toAcc = accountMap.get(tx.toAccountId)
            if (toAcc) {
              const toAccTxns = allTxByAccount.get(toAcc.id) ?? []
              entry.toAccountBalance  = getAccountBalanceAtDate(toAcc, toAccTxns, new Date(tx.date))
              entry.toAccountCurrency = toAcc.currency
            }
          }
          result.set(tx.id, entry)
        }
        // Undo this tx's effect on acc.id to step back in time
        if (tx.accountId === acc.id) {
          if (tx.type === 'income')    running -= tx.amount
          else if (tx.type === 'expense')   running += tx.amount
          else if (tx.type === 'transfer')  running += tx.amount
        } else {
          // tx.toAccountId === acc.id: undo the incoming transfer credit
          running -= (tx.originalAmount ?? tx.amount)
        }
      }
    }

    return result
  }, [visibleAccounts, allTxByAccount, accountMap])

  return (
    <>
      <DueRemindersSection />
      <TransactionList
        transactions={visibleTransactions}
        loading={loading}
        returnTo={listReturnTo}
        balanceMap={balanceAfterTx}
        layout="page"
        showQuickRangePicker
        initialFilters={initialFilters}
        initialQuickRange={initialQuickRange}
        onFiltersChange={(f) => { persistedFilters = f }}
        onQuickRangeChange={(qr) => { persistedQuickRange = qr }}
        onLoadRange={(since) => loadTx(since)}
        initialScrollOffset={persistedScrollOffset}
        onScrollChange={(off) => { persistedScrollOffset = off }}
      />
    </>
  )
}
