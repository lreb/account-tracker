import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import { normalizeAccount } from '@/lib/accounts'
import type { Account } from '@/types'

interface AccountsState {
  accounts: Account[]
  load: () => Promise<void>
  add: (a: Account) => Promise<void>
  update: (a: Account) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useAccountsStore = create<AccountsState>((set) => ({
  accounts: [],

  load: async () => {
    try {
      const accounts = (await db.accounts.toArray()).map(normalizeAccount)
      set({ accounts })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load accounts')
    }
  },

  add: async (account) => {
    try {
      const nextAccount = normalizeAccount(account)
      await db.accounts.add(nextAccount)
      set((s) => ({ accounts: [...s.accounts, nextAccount] }))
      toast.success('Account added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add account')
    }
  },

  update: async (account) => {
    try {
      const nextAccount = normalizeAccount(account)
      await db.accounts.put(nextAccount)
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === nextAccount.id ? nextAccount : a)),
      }))
      toast.success('Account updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update account')
    }
  },

  remove: async (id) => {
    try {
      await db.accounts.delete(id)
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }))
      toast.success('Account deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete account')
    }
  },
}))
