import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
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
      const accounts = await db.accounts.toArray()
      set({ accounts })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load accounts')
    }
  },

  add: async (account) => {
    try {
      await db.accounts.add(account)
      set((s) => ({ accounts: [...s.accounts, account] }))
      toast.success('Account added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add account')
    }
  },

  update: async (account) => {
    try {
      await db.accounts.put(account)
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === account.id ? account : a)),
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
