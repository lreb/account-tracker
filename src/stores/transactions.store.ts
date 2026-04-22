import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Transaction } from '@/types'

interface TransactionsState {
  transactions: Transaction[]
  loading: boolean
  load: (since?: string) => Promise<void>
  add: (t: Transaction) => Promise<void>
  update: (t: Transaction) => Promise<void>
  remove: (id: string) => Promise<void>
  removeMany: (ids: string[]) => void  // sync in-memory removal (DB already deleted by caller)
  removeLabelFromTransactions: (labelId: string) => Promise<void>
}

export const useTransactionsStore = create<TransactionsState>((set) => ({
  transactions: [],
  loading: false,

  load: async (since?: string) => {
    set({ loading: true })
    try {
      // When a cutoff date is provided, use the indexed 'date' field to filter inside
      // IndexedDB — only the rows we need cross the JS boundary (Option E).
      const transactions = since
        ? await db.transactions.where('date').aboveOrEqual(since).reverse().toArray()
        : await db.transactions.orderBy('date').reverse().toArray()
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

  removeMany: (ids) => {
    const set_ = new Set(ids)
    set((s) => ({ transactions: s.transactions.filter((t) => !set_.has(t.id)) }))
  },

  removeLabelFromTransactions: async (labelId) => {
    try {
      const allTx = await db.transactions.toArray()
      const affected = allTx.filter((t) => t.labels?.includes(labelId))
      if (affected.length === 0) return
      const updated = affected.map((t) => ({ ...t, labels: t.labels!.filter((l) => l !== labelId) }))
      await db.transactions.bulkPut(updated)
      set((s) => ({
        transactions: s.transactions.map((t) =>
          t.labels?.includes(labelId)
            ? { ...t, labels: t.labels.filter((l) => l !== labelId) }
            : t,
        ),
      }))
    } catch (err) {
      console.error(err)
    }
  },
}))
