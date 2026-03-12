import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import type { Category } from '@/types'

interface CategoriesState {
  categories: Category[]
  load: () => Promise<void>
  add: (c: Category) => Promise<void>
  update: (c: Category) => Promise<void>
  remove: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
}

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],

  load: async () => {
    try {
      const existing = await db.categories.toArray()
      if (existing.length === 0) {
        await db.categories.bulkAdd(DEFAULT_CATEGORIES)
      } else {
        const existingIds = new Set(existing.map((c) => c.id))
        const missing = DEFAULT_CATEGORIES.filter((d) => !existingIds.has(d.id))
        if (missing.length > 0) await db.categories.bulkAdd(missing)
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

  update: async (category) => {
    try {
      await db.categories.put(category)
      set((s) => ({ categories: s.categories.map((c) => (c.id === category.id ? category : c)) }))
      toast.success('Category updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update category')
    }
  },

  remove: async (id) => {
    try {
      const deletedAt = new Date().toISOString()
      await db.categories.update(id, { deletedAt })
      set((s) => ({
        categories: s.categories.map((c) => (c.id === id ? { ...c, deletedAt } : c)),
      }))
      toast.success('Category archived')
    } catch (err) {
      console.error(err)
      toast.error('Failed to archive category')
    }
  },

  restore: async (id) => {
    try {
      await db.categories.update(id, { deletedAt: undefined })
      set((s) => ({
        categories: s.categories.map((c) => {
          if (c.id !== id) return c
          const { deletedAt: _, ...rest } = c
          return rest as Category
        }),
      }))
      toast.success('Category restored')
    } catch (err) {
      console.error(err)
      toast.error('Failed to restore category')
    }
  },
}))
