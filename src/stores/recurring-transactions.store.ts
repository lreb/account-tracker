import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { RecurringTransaction } from '@/types'

interface RecurringTransactionsState {
  recurringTransactions: RecurringTransaction[]
  loading: boolean
  load: () => Promise<void>
  add: (r: RecurringTransaction) => Promise<void>
  update: (r: RecurringTransaction) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useRecurringTransactionsStore = create<RecurringTransactionsState>((set) => ({
  recurringTransactions: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const recurringTransactions = await db.recurringTransactions
        .orderBy('nextDueDate')
        .toArray()
      set({ recurringTransactions })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load reminders')
    } finally {
      set({ loading: false })
    }
  },

  add: async (r) => {
    try {
      await db.recurringTransactions.add(r)
      set((s) => ({
        recurringTransactions: [...s.recurringTransactions, r].sort((a, b) =>
          a.nextDueDate.localeCompare(b.nextDueDate),
        ),
      }))
      toast.success('Reminder added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add reminder')
    }
  },

  update: async (r) => {
    try {
      await db.recurringTransactions.put(r)
      set((s) => ({
        recurringTransactions: s.recurringTransactions.map((x) => (x.id === r.id ? r : x)),
      }))
    } catch (err) {
      console.error(err)
      toast.error('Failed to update reminder')
    }
  },

  remove: async (id) => {
    try {
      await db.recurringTransactions.delete(id)
      set((s) => ({
        recurringTransactions: s.recurringTransactions.filter((x) => x.id !== id),
      }))
      toast.success('Reminder deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete reminder')
    }
  },
}))
