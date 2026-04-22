import { useEffect, useMemo } from 'react'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { getVisibleAccounts } from '@/lib/accounts'
import type { Account, Category } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetValueFn = (name: any, value: any) => void

interface UseTransactionCoreFieldsOptions {
  watchType: string
  watchAccountId: string
  watchToAccountId?: string
  watchCurrency: string
  setValue: SetValueFn
  /** Keep the existing category visible even if soft-deleted or type-mismatched */
  existingCategoryId?: string
  isEdit?: boolean
}

export interface UseTransactionCoreFieldsResult {
  accounts: Account[]
  categories: Category[]
  visibleAccounts: Account[]
  sourceAccount: Account | undefined
  destAccount: Account | undefined
  isCrossCurrencyTransfer: boolean
  filteredCategories: Category[]
  baseCurrency: string
}

/**
 * Shared hook used by both TransactionForm and RecurringTransactionForm.
 * Encapsulates:
 *  - filtered category list by transaction type
 *  - source / destination account lookups
 *  - cross-currency transfer detection
 *  - effect: keep `currency` field in sync with selected account
 *  - effect: auto-fill `exchangeRate` from the DB cache
 */
export function useTransactionCoreFields({
  watchType,
  watchAccountId,
  watchToAccountId,
  watchCurrency,
  setValue,
  existingCategoryId,
  isEdit = false,
}: UseTransactionCoreFieldsOptions): UseTransactionCoreFieldsResult {
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()
  const { getRateForPair } = useExchangeRatesStore()

  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  const sourceAccount = useMemo(
    () => accounts.find((a) => a.id === watchAccountId),
    [accounts, watchAccountId],
  )

  const destAccount = useMemo(
    () => accounts.find((a) => a.id === watchToAccountId),
    [accounts, watchToAccountId],
  )

  const isCrossCurrencyTransfer = useMemo(
    () =>
      watchType === 'transfer' &&
      !!sourceAccount &&
      !!destAccount &&
      sourceAccount.currency !== destAccount.currency,
    [watchType, sourceAccount, destAccount],
  )

  const filteredCategories = useMemo(() => {
    const active = categories.filter((c) => {
      if (c.deletedAt) return false
      if (watchType === 'transfer') return true
      return c.type === watchType || c.type === 'any'
    })
    // Keep the currently-assigned category visible even if deleted or type-mismatched
    if (isEdit && existingCategoryId && !active.find((c) => c.id === existingCategoryId)) {
      const assigned = categories.find((c) => c.id === existingCategoryId)
      if (assigned) active.unshift(assigned)
    }
    return active
  }, [categories, watchType, isEdit, existingCategoryId])

  // Keep the `currency` form field in sync with the selected source account
  useEffect(() => {
    const acct = accounts.find((a) => a.id === watchAccountId)
    if (acct) setValue('currency', acct.currency)
  }, [watchAccountId, accounts, setValue])

  // Auto-fill exchange rate from the DB cache when the account currency differs
  // from baseCurrency. Cross-currency transfers skip this — rate is managed via
  // CrossCurrencyDialog in TransactionForm.
  useEffect(() => {
    if (isCrossCurrencyTransfer) return
    if (!watchCurrency || watchCurrency === baseCurrency) {
      setValue('exchangeRate', '')
      return
    }
    const cached = getRateForPair(watchCurrency, baseCurrency)
    if (cached !== null) setValue('exchangeRate', cached.toFixed(6))
  }, [watchCurrency, baseCurrency, getRateForPair, setValue, isCrossCurrencyTransfer])

  return {
    accounts,
    categories,
    visibleAccounts,
    sourceAccount,
    destAccount,
    isCrossCurrencyTransfer,
    filteredCategories,
    baseCurrency,
  }
}
