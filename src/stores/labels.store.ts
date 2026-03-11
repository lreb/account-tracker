import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Label } from '@/types'

interface LabelsState {
  labels: Label[]
  load: () => Promise<void>
  add: (label: Label) => Promise<void>
  update: (label: Label) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useLabelsStore = create<LabelsState>((set) => ({
  labels: [],

  load: async () => {
    try {
      const labels = await db.labels.toArray()
      set({ labels })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load labels')
    }
  },

  add: async (label) => {
    try {
      await db.labels.add(label)
      set((s) => ({ labels: [...s.labels, label] }))
      toast.success('Label created')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create label')
    }
  },

  update: async (label) => {
    try {
      await db.labels.put(label)
      set((s) => ({ labels: s.labels.map((l) => (l.id === label.id ? label : l)) }))
      toast.success('Label updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update label')
    }
  },

  remove: async (id) => {
    try {
      await db.labels.delete(id)
      set((s) => ({ labels: s.labels.filter((l) => l.id !== id) }))
      toast.success('Label deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete label')
    }
  },
}))
