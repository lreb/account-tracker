import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, ChevronDown, ChevronRight, Fuel, Plus, TrendingDown, TrendingUp, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getVisibleAccounts } from '@/lib/accounts'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useLabelsStore } from '@/stores/labels.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import {
  BALANCE_SHEET_PRESETS,
  convertBalanceToBase,
  getAccountBalanceAtDate,
  getAccountTransactionAmount,
  getComparisonDate,
  isTransactionForAccount,
  type BalanceSheetPreset,
} from '@/lib/balance-sheet'
import { formatCurrency } from '@/lib/currency'
import type { Account, Transaction } from '@/types'

import { LabelPickerButton } from '@/components/ui/label-picker-button'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'

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
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { labels } = useLabelsStore()
  const { vehicles } = useVehiclesStore()
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const { baseCurrency } = useSettingsStore()
  const { load: loadRates, getRateForPair } = useExchangeRatesStore()
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  const presetParam = searchParams.get('period')
  const selectedPreset = BALANCE_SHEET_PRESETS.includes(presetParam as BalanceSheetPreset)
    ? (presetParam as BalanceSheetPreset)
    : 'lastMonth'

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    void loadRates()
  }, [loadRates])

  useEffect(() => {
    if (searchParams.get('period') !== selectedPreset) {
      const next = new URLSearchParams(searchParams)
      next.set('period', selectedPreset)
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, selectedPreset, setSearchParams])

  const account = visibleAccounts.find((item) => item.id === accountId) ?? null
  const comparisonDate = useMemo(() => getComparisonDate(selectedPreset), [selectedPreset])

  const accountTransactions = useMemo(() => {
    if (!account) {
      return []
    }

    return transactions
      .filter((transaction) => isTransactionForAccount(transaction, account.id))
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [account, transactions])

  const filteredAccountTransactions = useMemo(
    () => filterLabelIds.length === 0
      ? accountTransactions
      : accountTransactions.filter((t) => filterLabelIds.some((id) => t.labels?.includes(id))),
    [accountTransactions, filterLabelIds],
  )

  const currentBalance = useMemo(() => {
    if (!account) {
      return 0
    }

    return getAccountBalanceAtDate(account, accountTransactions, new Date())
  }, [account, accountTransactions])

  const previousBalance = useMemo(() => {
    if (!account) {
      return 0
    }

    return getAccountBalanceAtDate(account, accountTransactions, comparisonDate)
  }, [account, accountTransactions, comparisonDate])

  const delta = currentBalance - previousBalance

  const netWorthContribution = useMemo(() => {
    if (!account) {
      return null
    }

    const baseValue = convertBalanceToBase(currentBalance, account.currency, baseCurrency, getRateForPair)
    if (baseValue === null) {
      return null
    }

    return account.type === 'liability' ? -baseValue : baseValue
  }, [account, currentBalance, baseCurrency, getRateForPair])

  const activeVehicles = useMemo(() => vehicles.filter((v) => !v.archivedAt), [vehicles])

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
              <p className="mt-1 text-xs text-gray-400">
                {t('balanceSheet.sameDateComparison', {
                  date: format(comparisonDate, 'MMM d, yyyy'),
                  period: t(`balanceSheet.periodLabels.${selectedPreset}`),
                })}
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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{t('balanceSheet.currentBalance')}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(currentBalance, account.currency)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{t('balanceSheet.change')}</p>
              <div className={`mt-1 inline-flex items-center gap-1 text-lg font-bold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {delta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{delta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(delta), account.currency)}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{t('balanceSheet.netWorthImpact')}</p>
              <p className={`mt-1 text-lg font-bold ${netWorthContribution !== null && netWorthContribution >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {netWorthContribution === null ? t('balanceSheet.unavailable') : formatCurrency(netWorthContribution, baseCurrency)}
              </p>
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
          <ul className="space-y-2">
            {filteredAccountTransactions.map((transaction) => {
              const category = categories.find((item) => item.id === transaction.categoryId)
              const presentation = getTransactionPresentation(transaction, account)
              return (
                <li key={transaction.id}>
                  <Link
                    to={`/transactions/${transaction.id}?accountId=${encodeURIComponent(account.id)}&returnTo=${encodeURIComponent(returnTo)}`}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      transaction.status === 'cancelled'
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${transaction.status === 'cancelled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{transaction.description}</p>
                      <p className="text-xs text-gray-400">
                        {category?.name ?? '—'} · {t(presentation.labelKey)} · {format(new Date(transaction.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${transaction.status === 'cancelled' ? 'line-through text-gray-400' : presentation.tone}`}>
                        {presentation.prefix}
                        {formatCurrency(presentation.amount, presentation.currency)}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">{t(`transactions.status.${transaction.status}`)}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <ScrollToTopButton />
    </div>
  )
}