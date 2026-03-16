import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { Eye, EyeOff, Pencil, Trash2, Plus, Wallet } from 'lucide-react'

import { accountSchema, type AccountFormValues } from '../schemas/account.schema'
import { getVisibleAccounts } from '@/lib/accounts'
import { useAccountsStore } from '@/stores/accounts.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useSettingsStore } from '@/stores/settings.store'
import type { Account, AccountType } from '@/types'
import { formatCurrency } from '@/lib/currency'
import { db } from '@/db'

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const ACCOUNT_TYPES = ['asset', 'liability'] as const

const COMMON_CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'COP', label: 'COP — Colombian Peso' },
  { code: 'ARS', label: 'ARS — Argentine Peso' },
  { code: 'CLP', label: 'CLP — Chilean Peso' },
]

interface AccountDialogProps {
  open: boolean
  editing: Account | null
  showOnboarding: boolean
  onOnboardingDone: () => void
  onClose: () => void
}

function AccountDialog({ open, editing, showOnboarding, onOnboardingDone, onClose }: AccountDialogProps) {
  const { t } = useTranslation()
  const { add, update } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { type: 'asset', currency: baseCurrency || 'USD', hidden: false, openingBalance: '0', name: '' },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        name: editing.name,
        type: editing.type,
        currency: editing.currency,
        hidden: editing.hidden ?? false,
        openingBalance: (editing.openingBalance / 100).toFixed(2),
      })
    } else {
      reset({ name: '', type: 'asset', currency: baseCurrency || 'USD', hidden: false, openingBalance: '0' })
    }
  }, [open, editing, reset, baseCurrency])

  const onSubmit = async (values: AccountFormValues) => {
    const balanceCents = Math.round(parseFloat(values.openingBalance) * 100)
    if (editing) {
      await update({ ...editing, ...values, openingBalance: balanceCents })
    } else {
      await add({ id: uuid(), ...values, openingBalance: balanceCents })
    }

    if (showOnboarding) {
      onOnboardingDone()
    }

    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset({ name: '', type: 'asset', currency: baseCurrency || 'USD', hidden: false, openingBalance: '0' }); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('common.edit') : t('common.add')} {t('settings.accounts')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {showOnboarding && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-1">
              <p className="font-semibold">{t('accounts.onboardingTitle')}</p>
              <p>{t('accounts.onboardingDesc')}</p>
              <p>{t('accounts.requiredHint')}</p>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">{t('accounts.name')} <span className="text-red-500">*</span></Label>
            <Input id="name" placeholder={t('accounts.namePlaceholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Label>{t('accounts.type')} <span className="text-red-500">*</span></Label>
            <Select
              value={watch('type')}
              onValueChange={(v) => setValue('type', v as AccountFormValues['type'])}
            >
              <SelectTrigger>
                <SelectValue>
                  {t(`accounts.types.${watch('type')}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`accounts.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <Label>{t('accounts.currency')} <span className="text-red-500">*</span></Label>
            <Select
              value={watch('currency')}
              onValueChange={(v) => setValue('currency', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CURRENCIES.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currency && <p className="text-xs text-red-500">{t(errors.currency.message!)}</p>}
          </div>

          {/* Opening Balance */}
          <div className="space-y-1">
            <Label htmlFor="openingBalance">{t('accounts.openingBalance')}</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('openingBalance')}
            />
            {errors.openingBalance && (
              <p className="text-xs text-red-500">{t(errors.openingBalance.message!)}</p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
            <button
              type="button"
              role="switch"
              aria-checked={watch('hidden')}
              onClick={() => setValue('hidden', !watch('hidden'))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                watch('hidden') ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  watch('hidden') ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div className="min-w-0">
              <Label className="cursor-pointer">{t('accounts.hideFromApp')}</Label>
              <p className="text-xs text-gray-500">{t('accounts.excludedFromTotals')}</p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            {showOnboarding && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOnboardingDone()
                  onClose()
                }}
              >
                {t('accounts.skipTour')}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AccountsSettingsPage() {
  const { t } = useTranslation()
  const { accounts, remove, update } = useAccountsStore()
  const { transactions } = useTransactionsStore()
  const { saveSetting } = useSettingsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (a: Account) => { setEditing(a); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  useEffect(() => {
    let mounted = true

    async function maybeStartOnboarding() {
      const row = await db.settings.get('accountsOnboardingSeen')
      if (!mounted || row?.value === '1') return
      if (accounts.length === 0) return

      setShowOnboarding(true)
      setEditing(accounts[0])
      setDialogOpen(true)
    }

    void maybeStartOnboarding()

    return () => {
      mounted = false
    }
  }, [accounts])

  async function markOnboardingDone() {
    setShowOnboarding(false)
    await saveSetting('accountsOnboardingSeen', '1')
  }

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

  const visibleAccounts = useMemo(() => getVisibleAccounts(accounts), [accounts])

  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = { asset: [], liability: [] }
    for (const account of accounts) {
      if (account.type in groups) {
        groups[account.type].push(account)
      } else {
        groups.asset.push(account)
      }
    }
    return groups
  }, [accounts])

  const groupTotal = (type: AccountType) => {
    const group = visibleAccounts.filter((account) => account.type === type)
    return group.reduce((sum, a) => sum + (accountBalances.get(a.id) ?? a.openingBalance), 0)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('settings.accounts')}</h1>
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
          {(Object.keys(groupedAccounts) as AccountType[]).map((type) => {
            const group = groupedAccounts[type]
            if (group.length === 0) return null
            return (
              <section key={type}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    {t(`accounts.types.${type}`)}
                    <span className="ml-1 text-xs font-normal normal-case text-gray-400">
                      — {t(`accounts.descriptions.${type}`)}
                    </span>
                  </h2>
                  <span className="text-sm font-semibold">
                    {formatCurrency(groupTotal(type), accounts[0]?.currency ?? 'USD')}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.map((account) => {
                    const balance = accountBalances.get(account.id) ?? account.openingBalance
                    return (
                      <li
                        key={account.id}
                        className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{account.name}</p>
                          <p className="text-xs text-gray-400">
                            {account.currency}
                            {account.hidden ? ` · ${t('accounts.hidden')}` : ''}
                          </p>
                          {account.hidden && (
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
                            onClick={() => remove(account.id)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        editing={editing}
        showOnboarding={showOnboarding}
        onOnboardingDone={() => { void markOnboardingDone() }}
        onClose={closeDialog}
      />
    </div>
  )
}
