import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE, getOtherSubtypeLabelKey, getOtherSubtypeValue } from '@/constants/account-subtypes'
import { sortAccounts } from '@/lib/accounts'
import { cn } from '@/lib/utils'
import type { Account, AccountType } from '@/types'

interface AccountGroup {
  type: AccountType
  subtype: string
  labelKey: string
  accounts: Account[]
}

function getSubtypeLabelKey(type: AccountType, subtype: string): string {
  const options = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[type] ?? []
  return options.find((option) => option.value === subtype)?.labelKey ?? getOtherSubtypeLabelKey(type)
}

function buildGroups(accounts: Account[], query: string): AccountGroup[] {
  const normalizedQuery = query.trim().toLowerCase()
  const matches = sortAccounts(accounts.filter((account) => !normalizedQuery || account.name.toLowerCase().includes(normalizedQuery)))
  return matches.reduce<AccountGroup[]>((groups, account) => {
    const subtype = account.subtype || getOtherSubtypeValue(account.type)
    const previous = groups[groups.length - 1]
    if (previous?.type === account.type && previous.subtype === subtype) previous.accounts.push(account)
    else groups.push({ type: account.type, subtype, labelKey: getSubtypeLabelKey(account.type, subtype), accounts: [account] })
    return groups
  }, [])
}

interface AccountMultiSelectProps {
  options: Account[]
  value: string[]
  onChange: (value: string[]) => void
  label: string
}

export function AccountMultiSelect({ options, value, onChange, label }: AccountMultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const groups = useMemo(() => buildGroups(options, search), [options, search])
  const selectedNames = options.filter((account) => value.includes(account.id)).map((account) => account.name)

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setSearch('') }}>
        <DialogTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input px-3 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className={cn('min-w-0 flex-1 truncate', selectedNames.length === 0 && 'text-muted-foreground')}>
            {selectedNames.length === 0 ? t('reports.selectAccountsForPerformance') : selectedNames.join(', ')}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DialogTrigger>
        <DialogContent showCloseButton={false} className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b px-4 py-3"><DialogTitle>{label}</DialogTitle></DialogHeader>
          <div className="border-b px-4 py-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus placeholder={t('common.search')} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p> : groups.map((group, index) => (
              <div key={`${group.type}-${group.subtype}`}>
                {(index === 0 || groups[index - 1].type !== group.type) && (
                  <div className="sticky top-0 z-10 border-b bg-muted/80 px-4 py-1.5 backdrop-blur-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t(`accounts.types.${group.type}`)}</p>
                  </div>
                )}
                <div className="px-2 pb-2 pt-1.5">
                  <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground/70">{t(group.labelKey)}</p>
                  {group.accounts.map((account) => {
                    const selected = value.includes(account.id)
                    return (
                      <button key={account.id} type="button" aria-pressed={selected} onClick={() => onChange(selected ? value.filter((id) => id !== account.id) : [...value, account.id])}
                        className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors', selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-medium">{account.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{t(group.labelKey)} · {account.currency}</span>
                        </span>
                        {selected && <CheckIcon aria-hidden="true" className="size-4 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
