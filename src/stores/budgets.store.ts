import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Budget } from '@/types'

interface BudgetsState {
  budgets: Budget[]
  load: () => Promise<void>
  add: (b: Budget) => Promise<void>
  update: (b: Budget) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useBudgetsStore = create<BudgetsState>((set) => ({
  budgets: [],

  load: async () => {
    try {
      const budgets = await db.budgets.toArray()
      set({ budgets })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load budgets')
    }
  },

  add: async (budget) => {
    try {
      await db.budgets.add(budget)
      set((s) => ({ budgets: [...s.budgets, budget] }))
      toast.success('Budget created')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create budget')
    }
  },

  update: async (budget) => {
    try {
      await db.budgets.put(budget)
      set((s) => ({
        budgets: s.budgets.map((b) => (b.id === budget.id ? budget : b)),
      }))
      toast.success('Budget updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update budget')
    }
  },

  remove: async (id) => {
    try {
      await db.budgets.delete(id)
      set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }))
      toast.success('Budget deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete budget')
    }
  },
}))
