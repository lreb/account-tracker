import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, Info, SlidersHorizontal, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getActiveAccounts, sortAccounts } from '@/lib/accounts'
import {
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE,
  getOtherSubtypeLabelKey,
  getOtherSubtypeValue,
} from '@/constants/account-subtypes'
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
import { db } from '@/db'
import type { Account, AccountType, Transaction } from '@/types'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability']
const DEFAULT_PRESET: BalanceSheetPreset = 'endLastMonth'

// Persists selected preset across navigation within the session
let persistedBalancePreset: BalanceSheetPreset = DEFAULT_PRESET

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

interface SubtypeGroup {
  key: string
  type: AccountType
  labelKey: string
  snapshots: AccountSnapshot[]
  currentNW: number
  previousNW: number
  shareOfNW: number | null
}

interface TypeSection {
  type: AccountType
  groups: SubtypeGroup[]
  currentNW: number
  previousNW: number
}

// ── Standalone delta badge (no hooks — safe outside component) ──────────────
function DeltaBadge({
  currentNW,
  previousNW,
  currency,
  size = 'sm',
}: {
  currentNW: number
  previousNW: number
  currency: string
  size?: 'sm' | 'xs'
}) {
  const delta = currentNW - previousNW
  if (delta === 0) return null
  const isUp = delta > 0
  const TrendIcon = isUp ? TrendingUp : TrendingDown
  const cls = size === 'xs'
    ? 'inline-flex items-center gap-0.5 text-[11px] font-medium'
    : 'inline-flex items-center gap-0.5 text-xs font-medium'
  return (
    <span className={`${cls} ${isUp ? 'text-green-600' : 'text-red-500'}`}>
      <TrendIcon size={size === 'xs' ? 10 : 12} />
      {delta > 0 ? '+' : ''}{formatCurrency(delta, currency)}
    </span>
  )
}

export default function BalanceSheetPage() {
  const { t } = useTranslation()
  const { accounts } = useAccountsStore()
  // Reload full transaction history on every mount — TransactionListPage loads a
  // date-filtered subset into this same store, so without an explicit reload the
  // Dexie trigger ref would be stale and the first render would show wrong balances.
  const { transactions: rawTransactions, load: loadTransactions } = useTransactionsStore()
  const [allTx, setAllTx] = useState<Transaction[]>([])
  const { baseCurrency } = useSettingsStore()
  const { load: loadRates, getRateForPair } = useExchangeRatesStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draftPreset, setDraftPreset] = useState<BalanceSheetPreset>(DEFAULT_PRESET)

  const presetParam = searchParams.get('period')
  const selectedPreset = BALANCE_SHEET_PRESETS.includes(presetParam as BalanceSheetPreset)
    ? (presetParam as BalanceSheetPreset)
    : persistedBalancePreset

  useEffect(() => { void loadTransactions() }, [loadTransactions])

  useEffect(() => {
    void loadRates()
  }, [loadRates])

  // Load ALL non-cancelled transactions directly from Dexie — bypasses any
  // date-range filter another page may have applied to the shared store.
  useEffect(() => {
    db.transactions
      .filter((tx) => tx.status !== 'cancelled')
      .toArray()
      .then(setAllTx)
      .catch(console.error)
  }, [rawTransactions])

  useEffect(() => {
    if (searchParams.get('period') !== selectedPreset) {
      const next = new URLSearchParams(searchParams)
      next.set('period', selectedPreset)
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, selectedPreset, setSearchParams])

  const comparisonDate = useMemo(() => getComparisonDate(selectedPreset), [selectedPreset])
  const visibleAccounts = useMemo(() => getActiveAccounts(accounts), [accounts])

  const snapshots = useMemo(() => {
    const rawSnapshots = visibleAccounts.map((account) => {
      const accountTransactions = allTx.filter((tx) => isTransactionForAccount(tx, account.id))
      const currentBalance = getAccountBalanceAtDate(account, accountTransactions, new Date())
      const previousBalance = getAccountBalanceAtDate(account, accountTransactions, comparisonDate)
      const delta = currentBalance - previousBalance
      const baseBalance = convertBalanceToBase(currentBalance, account.currency, baseCurrency, getRateForPair)
      const previousBaseBalance = convertBalanceToBase(previousBalance, account.currency, baseCurrency, getRateForPair)
      // Use the raw signed balance directly — liabilities have negative balances
      // (expenses reduce them), so no sign flip needed. This matches how
      // DashboardPage computes net worth and ensures trend arrows are correct.
      const signedContribution = baseBalance
      const previousSignedContribution = previousBaseBalance
      return {
        account, currentBalance, previousBalance, delta, baseBalance,
        netWorthContribution: signedContribution,
        previousNetWorthContribution: previousSignedContribution,
        shareOfNetWorth: null,
      } satisfies AccountSnapshot
    })
    // Use sum of absolutes as denominator so percentages are always positive
    // (assets and liabilities both show their magnitude as % of the total pool).
    const totalAbsNW = rawSnapshots.reduce((sum, s) => sum + Math.abs(s.netWorthContribution ?? 0), 0)
    return rawSnapshots.map((s) => ({
      ...s,
      shareOfNetWorth: s.netWorthContribution === null || totalAbsNW === 0
        ? null
        : (Math.abs(s.netWorthContribution) / totalAbsNW) * 100,
    }))
  }, [visibleAccounts, allTx, comparisonDate, baseCurrency, getRateForPair])

  const totalNetWorth = useMemo(
    () => snapshots.reduce((sum, s) => sum + (s.netWorthContribution ?? 0), 0),
    [snapshots],
  )
  // Used as denominator for group % — absolute sum so all groups show positive share.
  const totalAbsoluteNetWorth = useMemo(
    () => snapshots.reduce((sum, s) => sum + Math.abs(s.netWorthContribution ?? 0), 0),
    [snapshots],
  )
  const previousNetWorth = useMemo(
    () => snapshots.reduce((sum, s) => sum + (s.previousNetWorthContribution ?? 0), 0),
    [snapshots],
  )
  const missingConversionCount = useMemo(
    () => snapshots.filter((s) => s.baseBalance === null).length,
    [snapshots],
  )

  // Build type → subtype → account tree, sorted and with totals
  const typeSections = useMemo((): TypeSection[] => {
    return ACCOUNT_TYPES.flatMap((type) => {
      const typeSnapshots = snapshots.filter((s) => s.account.type === type)
      if (typeSnapshots.length === 0) return []

      const sortedAccounts = sortAccounts(typeSnapshots.map((s) => s.account))
      const sorted = sortedAccounts.map((a) => typeSnapshots.find((s) => s.account.id === a.id)!)

      const groups: SubtypeGroup[] = []
      for (const snapshot of sorted) {
        const effSub = snapshot.account.subtype || getOtherSubtypeValue(snapshot.account.type)
        const opts = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[snapshot.account.type] ?? []
        const labelKey = opts.find((o) => o.value === effSub)?.labelKey ?? getOtherSubtypeLabelKey(snapshot.account.type)
        const groupKey = `${type}::${labelKey}`
        const last = groups[groups.length - 1]
        if (last && last.key === groupKey) {
          last.snapshots.push(snapshot)
        } else {
          groups.push({ key: groupKey, type, labelKey, snapshots: [snapshot], currentNW: 0, previousNW: 0, shareOfNW: null })
        }
      }
      for (const group of groups) {
        group.currentNW = group.snapshots.reduce((sum, s) => sum + (s.netWorthContribution ?? 0), 0)
        group.previousNW = group.snapshots.reduce((sum, s) => sum + (s.previousNetWorthContribution ?? 0), 0)
        group.shareOfNW = totalAbsoluteNetWorth === 0 ? null : (Math.abs(group.currentNW) / totalAbsoluteNetWorth) * 100
      }
      return [{
        type,
        groups,
        currentNW: groups.reduce((sum, g) => sum + g.currentNW, 0),
        previousNW: groups.reduce((sum, g) => sum + g.previousNW, 0),
      }]
    })
  }, [snapshots, totalAbsoluteNetWorth])

  function openSheet() {
    setDraftPreset(selectedPreset)
    setSheetOpen(true)
  }

  function applyPreset() {
    const next = new URLSearchParams(searchParams)
    next.set('period', draftPreset)
    setSearchParams(next)
    persistedBalancePreset = draftPreset
    setSheetOpen(false)
  }

  function resetPreset() {
    const next = new URLSearchParams(searchParams)
    next.set('period', DEFAULT_PRESET)
    setSearchParams(next)
    persistedBalancePreset = DEFAULT_PRESET
    setDraftPreset(DEFAULT_PRESET)
    setSheetOpen(false)
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="p-4 pb-24 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('balanceSheet.title')}</h1>
          <p className="text-sm text-gray-500">{t('balanceSheet.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openSheet}
          className="relative flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm"
        >
          <SlidersHorizontal size={14} />
          {t('balanceSheet.filters.button')}
          <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
            {t(`balanceSheet.periods.${selectedPreset}`)}
          </span>
        </button>
      </div>

      {/* ── Net Worth comparison card ── */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          {t('balanceSheet.netWorth')}
        </p>
        <div className="grid grid-cols-2 divide-x border-t">
          <div className="px-4 py-3">
            <p className="text-[11px] text-gray-400 mb-1">{t(`balanceSheet.periods.${selectedPreset}`)}</p>
            <p className={`text-lg font-bold ${previousNetWorth >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
              {formatCurrency(previousNetWorth, baseCurrency)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{format(comparisonDate, 'MMM d, yyyy')}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] text-gray-400 mb-1">{t('balanceSheet.today')}</p>
            <p className={`text-lg font-bold ${totalNetWorth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(totalNetWorth, baseCurrency)}
            </p>
            <DeltaBadge currentNW={totalNetWorth} previousNW={previousNetWorth} currency={baseCurrency} />
          </div>
        </div>
        {missingConversionCount > 0 && (
          <p className="border-t px-4 py-2 text-xs text-amber-600">
            {t('balanceSheet.missingRates', { count: missingConversionCount, currency: baseCurrency })}
          </p>
        )}
      </div>

      {/* ── Empty state ── */}
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
          {typeSections.map((section) => (
            <section key={section.type} className="space-y-2">

              {/* Type header: name | prev NW | current NW + delta */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <div className="flex items-center gap-1">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {t(`accounts.types.${section.type}`)}
                    </h2>
                    <TooltipProvider delayDuration={2000} skipDelayDuration={500} >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors">
                            <Info size={12} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right"
                        sideOffset={4}
                        className="max-w-[200px] text-xs leading-snug"
                        >
                          {t(`accounts.descriptions.${section.type}`)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[11px] text-gray-400">{t(`balanceSheet.periods.${selectedPreset}`)}</p>
                    <p className={`text-sm font-semibold ${section.previousNW >= 0 ? 'text-gray-500' : 'text-red-500'}`}>
                      {formatCurrency(section.previousNW, baseCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">{t('balanceSheet.today')}</p>
                    <p className={`text-sm font-semibold ${section.currentNW >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                      {formatCurrency(section.currentNW, baseCurrency)}
                    </p>
                    <DeltaBadge currentNW={section.currentNW} previousNW={section.previousNW} currency={baseCurrency} size="xs" />
                  </div>
                </div>
              </div>

              {/* Subtype groups */}
              <div className="space-y-2">
                {section.groups.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key)
                  return (
                    <div key={group.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

                      {/* Collapsible group header */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="mt-0.5 shrink-0 text-gray-400">
                          {isCollapsed
                            ? <ChevronRight size={14} />
                            : <ChevronDown size={14} />
                          }
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Row 1: label (left) + share % (right) */}
                          <div className="flex items-baseline justify-between gap-1.5">
                            <p className="text-sm font-medium text-gray-700 whitespace-nowrap">{t(group.labelKey)}</p>
                            {group.shareOfNW !== null && (
                              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 whitespace-nowrap">
                                {group.shareOfNW.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {/* Row 2: previous amount (left) | current amount + delta (right) */}
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs ${group.previousNW >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                              {formatCurrency(group.previousNW, baseCurrency)}
                            </p>
                            <div className="text-right">
                              <p className={`text-sm font-semibold ${group.currentNW >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                                {formatCurrency(group.currentNW, baseCurrency)}
                              </p>
                              <DeltaBadge currentNW={group.currentNW} previousNW={group.previousNW} currency={baseCurrency} size="xs" />
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Account rows (expanded) */}
                      {!isCollapsed && (
                        <div className="border-t divide-y divide-gray-50">
                          {group.snapshots.map((snapshot) => {
                            // Arrow direction follows NW contribution (liabilities: balance up = NW down)
                            const nwDelta = (snapshot.netWorthContribution ?? 0) - (snapshot.previousNetWorthContribution ?? 0)
                            const balDelta = snapshot.currentBalance - snapshot.previousBalance
                            return (
                              <Link
                                key={snapshot.account.id}
                                to={`/balance-sheet/${snapshot.account.id}?period=${selectedPreset}`}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex-1 min-w-0 space-y-1">
                                  {/* Row 1: account name + currency badge */}
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900 truncate">{snapshot.account.name}</p>
                                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                      {snapshot.account.currency}
                                    </span>
                                  </div>
                                  {/* Row 2: previous balance (left) | current balance + delta (right) */}
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={`text-xs ${snapshot.previousBalance >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                                      {formatCurrency(snapshot.previousBalance, snapshot.account.currency)}
                                    </p>
                                    <div className="text-right shrink-0">
                                      <p className={`text-sm font-semibold ${snapshot.currentBalance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                        {formatCurrency(snapshot.currentBalance, snapshot.account.currency)}XX
                                      </p>
                                      {balDelta !== 0 && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${nwDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          {nwDelta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                          {balDelta > 0 ? '+' : ''}{formatCurrency(balDelta, snapshot.account.currency)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight size={14} className="shrink-0 mt-0.5 text-gray-300" />
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {/* ── Total Net Worth footer ── */}
          <div className="rounded-2xl bg-gray-900 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              {t('balanceSheet.totalNetWorth')}
            </p>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] text-gray-400">{t(`balanceSheet.periods.${selectedPreset}`)}</p>
                <p className={`text-base font-bold ${previousNetWorth >= 0 ? 'text-gray-200' : 'text-red-400'}`}>
                  {formatCurrency(previousNetWorth, baseCurrency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">{t('balanceSheet.today')}</p>
                <p className={`text-xl font-bold ${totalNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(totalNetWorth, baseCurrency)}
                </p>
                {(() => {
                  const delta = totalNetWorth - previousNetWorth
                  if (delta === 0) return null
                  const isUp = delta > 0
                  const TrendIcon = isUp ? TrendingUp : TrendingDown
                  return (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      <TrendIcon size={12} />
                      {delta > 0 ? '+' : ''}{formatCurrency(delta, baseCurrency)}
                    </span>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      <ScrollToTopButton />

      {/* ── Comparison period filter sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto rounded-t-2xl px-5 pt-2 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>{t('balanceSheet.filters.title')}</SheetTitle>
          </SheetHeader>

          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {t('balanceSheet.filters.compareTo')}
            </p>
            <div className="flex flex-wrap gap-2">
              {BALANCE_SHEET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDraftPreset(preset)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    draftPreset === preset
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {t(`balanceSheet.periods.${preset}`)}
                </button>
              ))}
            </div>
          </div>

          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={resetPreset}>{t('balanceSheet.filters.reset')}</Button>
            <Button className="flex-1" onClick={applyPreset}>{t('balanceSheet.filters.apply')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
