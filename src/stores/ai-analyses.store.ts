import { create } from 'zustand'
import { toast } from 'sonner'
import { subMonths } from 'date-fns'
import { db } from '@/db'
import type { AiAnalysis } from '@/types'

interface AiAnalysesState {
  analyses: AiAnalysis[]
  loading: boolean
  load: () => Promise<void>
  add: (analysis: AiAnalysis) => Promise<void>
  getLatestForPeriod: (period: string) => AiAnalysis | null
  cleanupOld: () => Promise<void>
}

export const useAiAnalysesStore = create<AiAnalysesState>((set, get) => ({
  analyses: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const analyses = await db.aiAnalyses
        .orderBy('createdAt')
        .reverse()
        .limit(24) // Keep last 24 analyses (2 years at 1 per month)
        .toArray()
      set({ analyses, loading: false })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load AI analysis history')
      set({ loading: false })
    }
  },

  add: async (analysis) => {
    try {
      await db.aiAnalyses.add(analysis)
      set((s) => ({ analyses: [analysis, ...s.analyses] }))
    } catch (err) {
      console.error(err)
      toast.error('Failed to save AI analysis')
    }
  },

  getLatestForPeriod: (period) => {
    const state = get()
    const matches = state.analyses
      .filter((a) => a.period === period)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return matches[0] || null
  },

  cleanupOld: async () => {
    try {
      const cutoff = subMonths(new Date(), 12).toISOString()
      const toDelete = await db.aiAnalyses
        .where('createdAt')
        .below(cutoff)
        .toArray()
      
      if (toDelete.length > 0) {
        await db.aiAnalyses.bulkDelete(toDelete.map((a) => a.id))
        set((s) => ({
          analyses: s.analyses.filter((a) => a.createdAt >= cutoff),
        }))
      }
    } catch (err) {
      console.error(err)
      // Silent failure for cleanup — not critical
    }
  },
}))
