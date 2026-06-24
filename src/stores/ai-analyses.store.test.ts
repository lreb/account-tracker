import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toast } from 'sonner'
import { subMonths, subDays } from 'date-fns'
import { db } from '@/db'
import { useAiAnalysesStore } from './ai-analyses.store'
import type { AiAnalysis } from '@/types'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('useAiAnalysesStore', () => {
  beforeEach(async () => {
    await db.aiAnalyses.clear()
    useAiAnalysesStore.setState({ analyses: [], loading: false })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.aiAnalyses.clear()
  })

  describe('load', () => {
    it('should load analyses from Dexie', async () => {
      const mockAnalysis: AiAnalysis = {
        id: 'test-1',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Test prompt',
        response: 'Test response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 42,
        createdAt: new Date().toISOString(),
      }

      await db.aiAnalyses.add(mockAnalysis)

      const { load } = useAiAnalysesStore.getState()
      await load()

      const { analyses } = useAiAnalysesStore.getState()
      expect(analyses).toHaveLength(1)
      expect(analyses[0]).toMatchObject(mockAnalysis)
    })

    it('should limit to last 24 analyses', async () => {
      const mockAnalyses: AiAnalysis[] = Array.from({ length: 30 }, (_, i) => ({
        id: `test-${i}`,
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Test prompt',
        response: 'Test response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 42,
        createdAt: subDays(new Date(), i).toISOString(),
      }))

      await db.aiAnalyses.bulkAdd(mockAnalyses)

      const { load } = useAiAnalysesStore.getState()
      await load()

      const { analyses } = useAiAnalysesStore.getState()
      expect(analyses).toHaveLength(24)
    })

    it('should sort analyses by createdAt descending', async () => {
      const now = new Date()
      const analysis1: AiAnalysis = {
        id: 'test-1',
        period: '2026-01',
        scopeDays: 90,
        prompt: 'Test',
        response: 'Test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 10,
        createdAt: subDays(now, 2).toISOString(),
      }

      const analysis2: AiAnalysis = {
        id: 'test-2',
        period: '2026-02',
        scopeDays: 90,
        prompt: 'Test',
        response: 'Test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 20,
        createdAt: now.toISOString(),
      }

      await db.aiAnalyses.bulkAdd([analysis1, analysis2])

      const { load } = useAiAnalysesStore.getState()
      await load()

      const { analyses } = useAiAnalysesStore.getState()
      expect(analyses[0].id).toBe('test-2')
      expect(analyses[1].id).toBe('test-1')
    })

    it('should handle load errors', async () => {
      vi.spyOn(db.aiAnalyses, 'orderBy').mockImplementation(() => {
        throw new Error('DB error')
      })

      const { load } = useAiAnalysesStore.getState()
      await load()

      expect(toast.error).toHaveBeenCalledWith('Failed to load AI analysis history')
    })
  })

  describe('add', () => {
    it('should add analysis to Dexie and state', async () => {
      const mockAnalysis: AiAnalysis = {
        id: 'test-1',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Test prompt',
        response: 'Test response',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 42,
        createdAt: new Date().toISOString(),
      }

      const { add } = useAiAnalysesStore.getState()
      await add(mockAnalysis)

      // Check Dexie
      const dbAnalyses = await db.aiAnalyses.toArray()
      expect(dbAnalyses).toHaveLength(1)
      expect(dbAnalyses[0]).toMatchObject(mockAnalysis)

      // Check state
      const { analyses } = useAiAnalysesStore.getState()
      expect(analyses).toHaveLength(1)
      expect(analyses[0]).toMatchObject(mockAnalysis)
    })

    it('should prepend new analysis to state', async () => {
      const analysis1: AiAnalysis = {
        id: 'test-1',
        period: '2026-01',
        scopeDays: 90,
        prompt: 'Test',
        response: 'Test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 10,
        createdAt: subDays(new Date(), 1).toISOString(),
      }

      const analysis2: AiAnalysis = {
        id: 'test-2',
        period: '2026-02',
        scopeDays: 90,
        prompt: 'Test',
        response: 'Test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 20,
        createdAt: new Date().toISOString(),
      }

      useAiAnalysesStore.setState({ analyses: [analysis1] })

      const { add } = useAiAnalysesStore.getState()
      await add(analysis2)

      const { analyses } = useAiAnalysesStore.getState()
      expect(analyses[0].id).toBe('test-2')
      expect(analyses[1].id).toBe('test-1')
    })

    it('should handle add errors', async () => {
      vi.spyOn(db.aiAnalyses, 'add').mockImplementation(() => {
        throw new Error('DB error')
      })

      const mockAnalysis: AiAnalysis = {
        id: 'test-1',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Test',
        response: 'Test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 42,
        createdAt: new Date().toISOString(),
      }

      const { add } = useAiAnalysesStore.getState()
      await add(mockAnalysis)

      expect(toast.error).toHaveBeenCalledWith('Failed to save AI analysis')
    })
  })

  describe('getLatestForPeriod', () => {
    it('should return latest analysis for given period', async () => {
      const now = new Date()
      const analysis1: AiAnalysis = {
        id: 'test-1',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Old',
        response: 'Old',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 10,
        createdAt: subDays(now, 2).toISOString(),
      }

      const analysis2: AiAnalysis = {
        id: 'test-2',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'New',
        response: 'New',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 20,
        createdAt: now.toISOString(),
      }

      const analysis3: AiAnalysis = {
        id: 'test-3',
        period: '2026-02',
        scopeDays: 90,
        prompt: 'Other',
        response: 'Other',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 15,
        createdAt: now.toISOString(),
      }

      useAiAnalysesStore.setState({ analyses: [analysis1, analysis2, analysis3] })

      const { getLatestForPeriod } = useAiAnalysesStore.getState()
      const result = getLatestForPeriod('2026-03')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('test-2')
      expect(result?.response).toBe('New')
    })

    it('should return null when no analysis exists for period', () => {
      const analysis: AiAnalysis = {
        id: 'test-1',
        period: '2026-02',
        scopeDays: 90,
        prompt: 'Test',
        response: 'Test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 10,
        createdAt: new Date().toISOString(),
      }

      useAiAnalysesStore.setState({ analyses: [analysis] })

      const { getLatestForPeriod } = useAiAnalysesStore.getState()
      const result = getLatestForPeriod('2026-03')

      expect(result).toBeNull()
    })

    it('should return null when analyses array is empty', () => {
      const { getLatestForPeriod } = useAiAnalysesStore.getState()
      const result = getLatestForPeriod('2026-03')

      expect(result).toBeNull()
    })
  })

  describe('cleanupOld', () => {
    it('should delete analyses older than 12 months', async () => {
      const now = new Date()
      const oldAnalysis: AiAnalysis = {
        id: 'old-1',
        period: '2025-01',
        scopeDays: 90,
        prompt: 'Old',
        response: 'Old',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 10,
        createdAt: subMonths(now, 13).toISOString(),
      }

      const recentAnalysis: AiAnalysis = {
        id: 'recent-1',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Recent',
        response: 'Recent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 20,
        createdAt: subMonths(now, 1).toISOString(),
      }

      await db.aiAnalyses.bulkAdd([oldAnalysis, recentAnalysis])
      useAiAnalysesStore.setState({ analyses: [oldAnalysis, recentAnalysis] })

      const { cleanupOld } = useAiAnalysesStore.getState()
      await cleanupOld()

      // Check Dexie
      const dbAnalyses = await db.aiAnalyses.toArray()
      expect(dbAnalyses).toHaveLength(1)
      expect(dbAnalyses[0].id).toBe('recent-1')

      // Check state
      const { analyses } = useAiAnalysesStore.getState()
      expect(analyses).toHaveLength(1)
      expect(analyses[0].id).toBe('recent-1')
    })

    it('should not delete anything if all analyses are recent', async () => {
      const analysis1: AiAnalysis = {
        id: 'test-1',
        period: '2026-02',
        scopeDays: 90,
        prompt: 'Test1',
        response: 'Test1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 10,
        createdAt: subMonths(new Date(), 1).toISOString(),
      }

      const analysis2: AiAnalysis = {
        id: 'test-2',
        period: '2026-03',
        scopeDays: 90,
        prompt: 'Test2',
        response: 'Test2',
        provider: 'openai',
        model: 'gpt-4o-mini',
        transactionCount: 20,
        createdAt: new Date().toISOString(),
      }

      await db.aiAnalyses.bulkAdd([analysis1, analysis2])
      useAiAnalysesStore.setState({ analyses: [analysis1, analysis2] })

      const { cleanupOld } = useAiAnalysesStore.getState()
      await cleanupOld()

      const dbAnalyses = await db.aiAnalyses.toArray()
      expect(dbAnalyses).toHaveLength(2)
    })

    it('should handle cleanup errors silently', async () => {
      vi.spyOn(db.aiAnalyses, 'where').mockImplementation(() => {
        throw new Error('DB error')
      })

      const { cleanupOld } = useAiAnalysesStore.getState()
      await cleanupOld()

      // Should not throw or call toast.error
      expect(toast.error).not.toHaveBeenCalled()
    })
  })
})
