import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Transaction } from '@/types'

interface TransactionsState {
  transactions: Transaction[]
  loading: boolean
  load: () => Promise<void>
  add: (t: Transaction) => Promise<void>
  update: (t: Transaction) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTransactionsStore = create<TransactionsState>((set) => ({
  transactions: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const transactions = await db.transactions.orderBy('date').reverse().toArray()
      set({ transactions })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load transactions')
    } finally {
      set({ loading: false })
    }
  },

  add: async (transaction) => {
    try {
      await db.transactions.add(transaction)
      set((s) => ({ transactions: [transaction, ...s.transactions] }))
      toast.success('Transaction added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add transaction')
    }
  },

  update: async (transaction) => {
    try {
      await db.transactions.put(transaction)
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === transaction.id ? transaction : t)),
      }))
      toast.success('Transaction updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update transaction')
    }
  },

  remove: async (id) => {
    try {
      await db.transactions.delete(id)
      set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
      toast.success('Transaction deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete transaction')
    }
  },
}))
