import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { Pencil, Trash2, Plus, Wallet } from 'lucide-react'

import { accountSchema, type AccountFormValues } from '../schemas/account.schema'
import { useAccountsStore } from '@/stores/accounts.store'
import type { Account } from '@/types'

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

const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'savings', 'investment', 'other'] as const

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
  onClose: () => void
}

function AccountDialog({ open, editing, onClose }: AccountDialogProps) {
  const { add, update } = useAccountsStore()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          type: editing.type,
          currency: editing.currency,
          openingBalance: (editing.openingBalance / 100).toFixed(2),
        }
      : { type: 'cash', currency: 'USD', openingBalance: '0' },
  })

  const onSubmit = async (values: AccountFormValues) => {
    const balanceCents = Math.round(parseFloat(values.openingBalance) * 100)
    if (editing) {
      await update({ ...editing, ...values, openingBalance: balanceCents })
    } else {
      await add({ id: uuid(), ...values, openingBalance: balanceCents })
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit' : 'Add'} Account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">Account Name</Label>
            <Input id="name" placeholder="e.g. Wallet, Main Bank" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Label>Account Type</Label>
            <Select
              defaultValue={editing?.type ?? 'cash'}
              onValueChange={(v) => setValue('type', v as AccountFormValues['type'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <Label>Currency</Label>
            <Select
              defaultValue={editing?.currency ?? 'USD'}
              onValueChange={(v) => setValue('currency', v)}
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
            {errors.currency && <p className="text-xs text-red-500">{errors.currency.message}</p>}
          </div>

          {/* Opening Balance */}
          <div className="space-y-1">
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('openingBalance')}
            />
            {errors.openingBalance && (
              <p className="text-xs text-red-500">{errors.openingBalance.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AccountsSettingsPage() {
  const { t } = useTranslation()
  const { accounts, remove } = useAccountsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (a: Account) => { setEditing(a); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('settings.accounts')}</h1>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <Wallet size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">No accounts yet.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Add your first account
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{account.name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {account.type} · {account.currency}
                </p>
              </div>
              <div className="flex gap-1">
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
          ))}
        </ul>
      )}

      <AccountDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
    </div>
  )
}
