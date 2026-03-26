import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import {
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE,
  getOtherSubtypeLabelKey,
  getOtherSubtypeValue,
} from '@/constants/account-subtypes'
import { cn } from '@/lib/utils'
import type { Account, AccountType } from '@/types'

// ─── helpers ────────────────────────────────────────────────────────────────

const TYPE_ORDER: AccountType[] = ['asset', 'liability']

function getSubtypeLabelKey(type: AccountType, subtypeValue: string): string {
  const opts = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[type] ?? []
  return opts.find((o) => o.value === subtypeValue)?.labelKey ?? getOtherSubtypeLabelKey(type)
}

function getSubtypeOrder(type: AccountType, subtypeValue: string): number {
  const opts = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[type] ?? []
  const idx = opts.findIndex((o) => o.value === subtypeValue)
  return idx === -1 ? opts.length : idx
}

interface AccountGroup {
  typeKey: AccountType
  subtypeValue: string
  subtypeLabelKey: string
  accounts: Account[]
}

function buildGroups(accounts: Account[], query: string): AccountGroup[] {
  const q = query.trim().toLowerCase()
  const filtered = accounts
    .filter((a) => !a.cancelled)
    .filter((a) => !q || a.name.toLowerCase().includes(q))

  const sorted = [...filtered].sort((a, b) => {
    const tA = TYPE_ORDER.indexOf(a.type)
    const tB = TYPE_ORDER.indexOf(b.type)
    if (tA !== tB) return tA - tB

    const effSubA = a.subtype || getOtherSubtypeValue(a.type)
    const effSubB = b.subtype || getOtherSubtypeValue(b.type)
    const oA = getSubtypeOrder(a.type, effSubA)
    const oB = getSubtypeOrder(b.type, effSubB)
    if (oA !== oB) return oA - oB

    return a.name.localeCompare(b.name)
  })

  const groups: AccountGroup[] = []
  for (const account of sorted) {
    const subtypeValue = account.subtype || getOtherSubtypeValue(account.type)
    const last = groups[groups.length - 1]
    if (last && last.typeKey === account.type && last.subtypeValue === subtypeValue) {
      last.accounts.push(account)
    } else {
      groups.push({
        typeKey: account.type,
        subtypeValue,
        subtypeLabelKey: getSubtypeLabelKey(account.type, subtypeValue),
        accounts: [account],
      })
    }
  }
  return groups
}

// ─── component ──────────────────────────────────────────────────────────────

interface AccountSelectProps {
  value: string
  onChange: (value: string) => void
  /** Pre-filtered list of accounts to show in the popup */
  options: Account[]
  /** Pre-translated label string */
  label: string
  /** When provided, each account row shows its current balance */
  balances?: Map<string, number>
  error?: string
}

export function AccountSelect({ value, onChange, options, label, balances, error }: AccountSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedAccount = options.find((a) => a.id === value)

  const groups = useMemo(() => buildGroups(options, search), [options, search])

  function handleOpenChange(next: boolean) {
    if (next) setSearch('')
    setOpen(next)
  }

  function handleSelect(accountId: string) {
    onChange(accountId)
    setOpen(false)
  }

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-1 text-sm text-left transition-colors outline-none',
            'hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            error ? 'border-destructive ring-3 ring-destructive/20' : 'border-input',
          )}
          aria-invalid={!!error}
        >
          {selectedAccount ? (
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{selectedAccount.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {formatCurrency(
                  balances?.get(selectedAccount.id) ?? selectedAccount.openingBalance,
                  selectedAccount.currency,
                )}
              </span>
            </span>
          ) : (
            <span className="flex-1 text-muted-foreground">{t('transactions.selectAccount')}</span>
          )}
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DialogTrigger>

        <DialogContent
          showCloseButton={false}
          className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t('transactions.selectAccount')}</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="border-b px-4 py-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Grouped account list */}
          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t('common.noResults')}
              </p>
            ) : (
              groups.map((group, gi) => {
                const showTypeHeader =
                  gi === 0 || groups[gi - 1].typeKey !== group.typeKey
                return (
                  <div key={`${group.typeKey}-${group.subtypeValue}`}>
                    {showTypeHeader && (
                      <div className="sticky top-0 z-10 border-b bg-muted/80 px-4 py-1.5 backdrop-blur-xs">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {t(`accounts.types.${group.typeKey}`)}
                        </p>
                      </div>
                    )}
                    <div className="px-2 pb-2 pt-1.5">
                      <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground/70">
                        {t(group.subtypeLabelKey)}
                      </p>
                      {group.accounts.map((account) => {
                        const balance =
                          balances?.get(account.id) ?? account.openingBalance
                        const isSelected = account.id === value
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleSelect(account.id)}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted',
                            )}
                          >
                            <span className="truncate font-medium">{account.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatCurrency(balance, account.currency)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
