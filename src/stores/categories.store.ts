import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import type { Category } from '@/types'

interface CategoriesState {
  categories: Category[]
  load: () => Promise<void>
  add: (c: Category) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],

  load: async () => {
    try {
      const count = await db.categories.count()
      if (count === 0) {
        await db.categories.bulkAdd(DEFAULT_CATEGORIES)
      }
      const categories = await db.categories.toArray()
      set({ categories })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load categories')
    }
  },

  add: async (category) => {
    try {
      await db.categories.add(category)
      set((s) => ({ categories: [...s.categories, category] }))
      toast.success('Category added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add category')
    }
  },

  remove: async (id) => {
    try {
      await db.categories.delete(id)
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
      toast.success('Category deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete category')
    }
  },
}))
