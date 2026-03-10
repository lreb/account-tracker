import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { AppTheme } from '@/types'

interface SettingsState {
  baseCurrency: string
  language: string
  theme: AppTheme
  load: () => Promise<void>
  saveSetting: (key: string, value: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  baseCurrency: 'USD',
  language: 'en',
  theme: 'system',

  load: async () => {
    try {
      const rows = await db.settings.toArray()
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      set({
        baseCurrency: map['baseCurrency'] ?? 'USD',
        language: map['language'] ?? 'en',
        theme: (map['theme'] as AppTheme) ?? 'system',
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load settings')
    }
  },

  saveSetting: async (key, value) => {
    try {
      await db.settings.put({ key, value })
      if (key === 'baseCurrency') set({ baseCurrency: value })
      else if (key === 'language') set({ language: value })
      else if (key === 'theme') set({ theme: value as AppTheme })
    } catch (err) {
      console.error(err)
      toast.error('Failed to save setting')
    }
  },
}))
