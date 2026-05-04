import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { AppTheme } from '@/types'

interface SettingsState {
  baseCurrency: string
  language: string
  theme: AppTheme
  googleClientId: string
  googleDriveFolderId: string
  googleDriveFolderName: string
  aiProvider: string
  aiApiKey: string
  aiBaseUrl: string
  aiModel: string
  load: () => Promise<void>
  saveSetting: (key: string, value: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  baseCurrency: 'USD',
  language: 'en',
  theme: 'system',
  googleClientId: '',
  googleDriveFolderId: 'root',
  googleDriveFolderName: '',
  aiProvider: '',
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',

  load: async () => {
    try {
      const rows = await db.settings.toArray()
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      set({
        baseCurrency: map['baseCurrency'] ?? 'USD',
        language: map['language'] ?? 'en',
        theme: (map['theme'] as AppTheme) ?? 'system',
        googleClientId: map['googleClientId'] ?? '',
        googleDriveFolderId: map['googleDriveFolderId'] ?? 'root',
        googleDriveFolderName: map['googleDriveFolderName'] ?? '',
        aiProvider: map['aiProvider'] ?? '',
        aiApiKey: map['aiApiKey'] ?? '',
        aiBaseUrl: map['aiBaseUrl'] ?? 'https://api.openai.com/v1',
        aiModel: map['aiModel'] ?? 'gpt-4o-mini',
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
      else if (key === 'googleClientId') set({ googleClientId: value })
      else if (key === 'googleDriveFolderId') set({ googleDriveFolderId: value })
      else if (key === 'googleDriveFolderName') set({ googleDriveFolderName: value })
      else if (key === 'aiProvider') set({ aiProvider: value })
      else if (key === 'aiApiKey') set({ aiApiKey: value })
      else if (key === 'aiBaseUrl') set({ aiBaseUrl: value })
      else if (key === 'aiModel') set({ aiModel: value })
    } catch (err) {
      console.error(err)
      toast.error('Failed to save setting')
    }
  },
}))
