import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getVisibleAccounts } from '@/lib/accounts'
import { useAccountsStore } from '@/stores/accounts.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import {
  BALANCE_SHEET_PRESETS,
  convertBalanceToBase,
  getAccountBalanceAtDate,
  getComparisonDate,
  isTransactionForAccount,
  type BalanceSheetPreset,
} from '@/lib/balance-sheet'
import { formatCurrency } from '@/lib/currency'
import type { Account, AccountType } from '@/types'

import { Button } from '@/components/ui/button'

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability']
const DEFAULT_PRESET: BalanceSheetPreset = 'lastMonth'

interface AccountSnapshot {
  account: Account
  currentBalance: number
  previousBalance: number
  delta: number
  baseBalance: number | null
  netWorthContribution: number | null
  previousNetWorthContribution: number | null
  shareOfNetWorth: number | null
}

export default function BalanceSheetPage() {
  const { t } = useTranslation()
  const { accounts } = useAccountsStore()
  const { transactions } = useTransactionsStore()
  const { baseCurrency } = useSettingsStore()
  const { load: loadRates, getRateForPair } = useExchangeRatesStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const presetParam = searchParams.get('period')
  const selectedPreset = BALANCE_SHEET_PRESETS.includes(presetParam as BalanceSheetPreset)
    ? (presetParam as BalanceSheetPreset)
    : DEFAULT_PRESET

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

  const comparisonDate = useMemo(() => getComparisonDate(selectedPreset), [selectedPreset])
  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  const snapshots = useMemo(() => {
    const rawSnapshots = visibleAccounts.map((account) => {
      const accountTransactions = transactions.filter((transaction) => isTransactionForAccount(transaction, account.id))
      const currentBalance = getAccountBalanceAtDate(account, accountTransactions, new Date())
      const previousBalance = getAccountBalanceAtDate(account, accountTransactions, comparisonDate)
      const delta = currentBalance - previousBalance
      const baseBalance = convertBalanceToBase(currentBalance, account.currency, baseCurrency, getRateForPair)
      const previousBaseBalance = convertBalanceToBase(previousBalance, account.currency, baseCurrency, getRateForPair)
      const signedContribution = baseBalance === null
        ? null
        : account.type === 'liability'
          ? -baseBalance
          : baseBalance
      const previousSignedContribution = previousBaseBalance === null
        ? null
        : account.type === 'liability'
          ? -previousBaseBalance
          : previousBaseBalance

      return {
        account,
        currentBalance,
        previousBalance,
        delta,
        baseBalance,
        netWorthContribution: signedContribution,
        previousNetWorthContribution: previousSignedContribution,
        shareOfNetWorth: null,
      } satisfies AccountSnapshot
    })

    const totalNetWorth = rawSnapshots.reduce((sum, snapshot) => sum + (snapshot.netWorthContribution ?? 0), 0)

    return rawSnapshots.map((snapshot) => ({
      ...snapshot,
      shareOfNetWorth:
        snapshot.netWorthContribution === null || totalNetWorth === 0
          ? null
          : (snapshot.netWorthContribution / totalNetWorth) * 100,
    }))
  }, [visibleAccounts, transactions, comparisonDate, baseCurrency, getRateForPair])

  const groupedSnapshots = useMemo(() => {
    return ACCOUNT_TYPES.reduce<Record<AccountType, AccountSnapshot[]>>((groups, type) => {
      groups[type] = snapshots.filter((snapshot) => snapshot.account.type === type)
      return groups
    }, { asset: [], liability: [] })
  }, [snapshots])

  const totalNetWorth = useMemo(() => {
    return snapshots.reduce((sum, snapshot) => sum + (snapshot.netWorthContribution ?? 0), 0)
  }, [snapshots])

  const previousNetWorth = useMemo(() => {
    return snapshots.reduce((sum, snapshot) => sum + (snapshot.previousNetWorthContribution ?? 0), 0)
  }, [snapshots])

  const netWorthDelta = totalNetWorth - previousNetWorth

  const missingConversionCount = useMemo(() => {
    return snapshots.filter((snapshot) => snapshot.baseBalance === null).length
  }, [snapshots])

  const updatePeriod = (preset: BalanceSheetPreset) => {
    const next = new URLSearchParams(searchParams)
    next.set('period', preset)
    setSearchParams(next)
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('balanceSheet.title')}</h1>
            <p className="text-sm text-gray-500">{t('balanceSheet.subtitle')}</p>
          </div>
          <div className="rounded-2xl border bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              {t('balanceSheet.netWorth')}
            </p>
            <p className={`text-lg font-bold ${totalNetWorth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(totalNetWorth, baseCurrency)}
            </p>
            <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${netWorthDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {netWorthDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>
                {netWorthDelta >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(netWorthDelta), baseCurrency)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              {t('balanceSheet.vsReference', { period: t(`balanceSheet.periodLabels.${selectedPreset}`) })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {BALANCE_SHEET_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => updatePeriod(preset)}
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

        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-gray-900">{t('balanceSheet.comparisonWindow')}</p>
              <p className="text-xs text-gray-500">
                {t('balanceSheet.sameDateComparison', {
                  date: format(comparisonDate, 'MMM d, yyyy'),
                  period: t(`balanceSheet.periodLabels.${selectedPreset}`),
                })}
              </p>
            </div>
            {missingConversionCount > 0 && (
              <p className="max-w-48 text-right text-xs text-amber-600">
                {t('balanceSheet.missingRates', { count: missingConversionCount, currency: baseCurrency })}
              </p>
            )}
          </div>
        </div>
      </div>

      {visibleAccounts.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center shadow-sm">
          <Wallet size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('balanceSheet.noAccounts')}</p>
          <Link to="/settings/accounts" className="mt-4 inline-flex">
            <Button variant="outline" size="sm">{t('balanceSheet.manageAccounts')}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {ACCOUNT_TYPES.map((type) => {
            const items = groupedSnapshots[type]
            if (items.length === 0) {
              return null
            }

            const typeNetWorth = items.reduce((sum, snapshot) => sum + (snapshot.netWorthContribution ?? 0), 0)

            return (
              <section key={type} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {t(`accounts.types.${type}`)}
                    </h2>
                    <p className="text-xs text-gray-400">{t(`accounts.descriptions.${type}`)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{t('balanceSheet.sectionNetWorth')}</p>
                    <p className={`text-sm font-semibold ${typeNetWorth >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                      {formatCurrency(typeNetWorth, baseCurrency)}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {items.map((snapshot) => {
                    const isUp = snapshot.delta >= 0
                    return (
                      <li key={snapshot.account.id}>
                        <Link
                          to={`/balance-sheet/${snapshot.account.id}?period=${selectedPreset}`}
                          className="block rounded-3xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-blue-100 hover:bg-gray-50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-gray-900">{snapshot.account.name}</p>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                  {snapshot.account.currency}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span>
                                  {t('balanceSheet.shareOfNetWorth')}:{' '}
                                  <strong className="text-gray-700">
                                    {snapshot.shareOfNetWorth === null ? t('balanceSheet.unavailable') : `${snapshot.shareOfNetWorth.toFixed(1)}%`}
                                  </strong>
                                </span>
                                <span>
                                  {t('balanceSheet.netWorthImpact')}:{' '}
                                  <strong className="text-gray-700">
                                    {snapshot.netWorthContribution === null
                                      ? t('balanceSheet.unavailable')
                                      : formatCurrency(snapshot.netWorthContribution, baseCurrency)}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={`text-base font-bold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                                {formatCurrency(snapshot.currentBalance, snapshot.account.currency)}
                              </p>
                              <div className={`mt-1 inline-flex items-center gap-1 text-xs ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                <span>
                                  {snapshot.delta >= 0 ? '+' : '-'}
                                  {formatCurrency(Math.abs(snapshot.delta), snapshot.account.currency)}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-gray-400">
                                {t('balanceSheet.vsReference', { period: t(`balanceSheet.periodLabels.${selectedPreset}`) })}
                              </p>
                            </div>

                            <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}