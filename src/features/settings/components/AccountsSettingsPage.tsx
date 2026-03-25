import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Pencil, Trash2, Plus, Wallet } from 'lucide-react'

import {
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE,
  getOtherSubtypeLabelKey,
} from '@/constants/account-subtypes'
import { getActiveAccounts } from '@/lib/accounts'
import { useAccountsStore } from '@/stores/accounts.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import type { Account, AccountType } from '@/types'
import { formatCurrency } from '@/lib/currency'
import { db } from '@/db'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'

const OTHER_SUBTYPE_VALUE = '__other__'
const TYPE_ORDER: AccountType[] = ['asset', 'liability']

function getSubtypeGroupValue(subtype?: string): string {
  if (!subtype) return OTHER_SUBTYPE_VALUE
  return subtype
}

export default function AccountsSettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { accounts, remove, update } = useAccountsStore()
  const { transactions, removeMany } = useTransactionsStore()
  const [actionAccount, setActionAccount] = useState<Account | null>(null)
  const [processingAccountAction, setProcessingAccountAction] = useState(false)
  const openAdd = () => {
    navigate('/settings/accounts/new')
  }

  const openEdit = (account: Account) => {
    navigate(`/settings/accounts/${encodeURIComponent(account.id)}`)
  }

  const closeActionDialog = () => {
    if (processingAccountAction) return
    setActionAccount(null)
  }

  const accountCascadeDeleteCount = useMemo(() => {
    if (!actionAccount) return 0
    return transactions.filter(
      (transaction) =>
        transaction.accountId === actionAccount.id ||
        transaction.toAccountId === actionAccount.id,
    ).length
  }, [actionAccount, transactions])

  const archiveAccount = async (account: Account) => {
    setProcessingAccountAction(true)
    try {
      await update({ ...account, hidden: true })
      setActionAccount(null)
    } finally {
      setProcessingAccountAction(false)
    }
  }

  const deleteAccountCascade = async (account: Account) => {
    setProcessingAccountAction(true)
    try {
      const transactionIds = transactions
        .filter(
          (transaction) =>
            transaction.accountId === account.id ||
            transaction.toAccountId === account.id,
        )
        .map((transaction) => transaction.id)

      if (transactionIds.length > 0) {
        await db.transactions.bulkDelete(transactionIds)
        removeMany(transactionIds)
      }

      await remove(account.id)
      setActionAccount(null)
    } finally {
      setProcessingAccountAction(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function maybeStartOnboarding() {
      const row = await db.settings.get('accountsOnboardingSeen')
      if (!mounted || row?.value === '1') return

      const accountCount = await db.accounts.count()
      if (accountCount > 0) return

      navigate('/settings/accounts/new?onboarding=1', { replace: true })
    }

    void maybeStartOnboarding()

    return () => {
      mounted = false
    }
  }, [accounts.length, navigate])

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>()
    for (const account of accounts) {
      const txs = transactions.filter(
        (t) => t.accountId === account.id || (t.type === 'transfer' && t.toAccountId === account.id),
      )
      const net = txs.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount
        if (t.type === 'expense') return sum - t.amount
        if (t.type === 'transfer') {
          return t.accountId === account.id ? sum - t.amount : sum + t.amount
        }
        return sum
      }, 0)
      map.set(account.id, account.openingBalance + net)
    }
    return map
  }, [accounts, transactions])

  const groupedAccounts = useMemo(() => {
    return TYPE_ORDER.map((type) => {
      const accountsByType = accounts.filter((account) => account.type === type)
      const subgroupMap = new Map<string, Account[]>()

      for (const account of accountsByType) {
        const key = getSubtypeGroupValue(account.subtype)
        subgroupMap.set(key, [...(subgroupMap.get(key) ?? []), account])
      }

      const orderedKnownKeys = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[type].map((option) => option.value)
      const unknownKeys = Array.from(subgroupMap.keys())
        .filter((key) => !orderedKnownKeys.includes(key) && key !== OTHER_SUBTYPE_VALUE)
        .sort((a, b) => a.localeCompare(b))

      const orderedSubgroupKeys = [
        ...orderedKnownKeys,
        OTHER_SUBTYPE_VALUE,
        ...unknownKeys,
      ].filter((key) => subgroupMap.has(key))

      const subgroups = orderedSubgroupKeys.map((key) => {
        const option = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[type].find((item) => item.value === key)
        const label = key === OTHER_SUBTYPE_VALUE
          ? t(getOtherSubtypeLabelKey(type))
          : option
            ? t(option.labelKey)
            : key

        return {
          key,
          label,
          accounts: subgroupMap.get(key) ?? [],
        }
      })

      return { type, subgroups }
    })
  }, [accounts, t])

  const activeAccounts = useMemo(() => getActiveAccounts(accounts), [accounts])

  const groupTotal = (type: AccountType) => {
    const group = activeAccounts.filter((account) => account.type === type)
    return group.reduce((sum, account) => sum + (accountBalances.get(account.id) ?? account.openingBalance), 0)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-xl font-bold">{t('settings.accounts')}</h1>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          {t('common.add')}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <Wallet size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">{t('accounts.noAccounts')}</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            {t('accounts.addFirst')}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedAccounts.map(({ type, subgroups }) => {
            const totalInType = subgroups.reduce((count, subgroup) => count + subgroup.accounts.length, 0)
            if (totalInType === 0) return null
            return (
              <section key={type}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    {t(`accounts.types.${type}`)}
                    <span className="ml-1 text-xs font-normal normal-case text-gray-400">
                      - {t(`accounts.descriptions.${type}`)}
                    </span>
                  </h2>
                  <span className="text-sm font-semibold">
                    {formatCurrency(groupTotal(type), accounts[0]?.currency ?? 'USD')}
                  </span>
                </div>
                <div className="space-y-3">
                  {subgroups.map((subgroup) => (
                    <div key={`${type}:${subgroup.key}`} className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 px-1">
                        {subgroup.label}
                      </p>
                      <ul className="space-y-2">
                        {subgroup.accounts.map((account) => {
                          const balance = accountBalances.get(account.id) ?? account.openingBalance
                          return (
                            <li
                              key={account.id}
                              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                                account.cancelled
                                  ? 'bg-red-50 border-red-200'
                                  : account.hidden
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-white'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${account.cancelled ? 'text-gray-400' : ''}`}>{account.name}</p>
                                <p className="text-xs text-gray-400">
                                  {account.currency}
                                  {account.cancelled ? ` · ${t('accounts.cancelled')}` : account.hidden ? ` · ${t('accounts.hidden')}` : ''}
                                </p>
                                {account.cancelled && (
                                  <p className="text-xs text-red-600">{t('accounts.cancelledExcluded')}</p>
                                )}
                                {!account.cancelled && account.hidden && (
                                  <p className="text-xs text-amber-600">{t('accounts.excludedFromTotals')}</p>
                                )}
                              </div>
                              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                                {formatCurrency(balance, account.currency)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => update({ ...account, hidden: !(account.hidden ?? false) })}
                                >
                                  {account.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(account)}
                                >
                                  <Pencil size={15} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={() => setActionAccount(account)}
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Dialog open={Boolean(actionAccount)} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('accounts.deleteConfirmTitle', 'Archive or permanently delete account?')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {t('accounts.deleteConfirmDesc', {
                name: actionAccount?.name ?? '',
                defaultValue: 'You are about to remove account "{{name}}" from active usage.',
              })}
            </p>
            <p>
              {t('accounts.deleteConfirmCascade', {
                count: accountCascadeDeleteCount,
                defaultValue: 'If you delete permanently, {{count}} linked transaction(s) will also be deleted and cannot be recovered.',
              })}
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeActionDialog} disabled={processingAccountAction}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!actionAccount || processingAccountAction}
              onClick={() => { if (actionAccount) void archiveAccount(actionAccount) }}
            >
              {t('accounts.archiveInstead', 'Archive account')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!actionAccount || processingAccountAction}
              onClick={() => { if (actionAccount) void deleteAccountCascade(actionAccount) }}
            >
              {t('accounts.deletePermanently', 'Delete permanently')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollToTopButton />
    </div>
  )
}
