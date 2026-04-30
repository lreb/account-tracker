import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BotMessageSquare, Loader2, Sparkles, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSettingsStore } from '@/stores/settings.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { createAiProvider } from '@/lib/ai/ai-provider'
import { buildFinancialSummary, formatSummaryForPrompt } from '@/lib/ai/financial-summary'

const SYSTEM_PROMPT = `You are a personal finance assistant. The user will share a monthly financial summary.
Provide 3–5 short, actionable insights. Be direct. Focus on patterns, over-budget categories, 
and one concrete saving suggestion. Use plain language. Do not ask follow-up questions.`

export default function AiAnalysisPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aiProvider, aiApiKey, aiBaseUrl, aiModel, baseCurrency } = useSettingsStore()
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { budgets } = useBudgetsStore()

  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isConfigured = !!aiProvider && !!aiBaseUrl && !!aiModel

  const currentPeriodLabel = useMemo(() => format(new Date(), 'MMMM yyyy'), [])

  async function handleAnalyze() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setResponse('')

    try {
      let config
      if (aiProvider === 'openai-compatible') {
        config = { type: 'openai-compatible' as const, baseUrl: aiBaseUrl, apiKey: aiApiKey, model: aiModel }
      } else if (aiProvider === 'ollama') {
        config = { type: 'ollama' as const, baseUrl: aiBaseUrl, model: aiModel }
      } else {
        throw new Error(t('ai.providerNotImplemented'))
      }

      const summary = buildFinancialSummary(transactions, categories, budgets, baseCurrency)
      const summaryText = formatSummaryForPrompt(summary)
      const provider = await createAiProvider(config)

      const reply = await provider.chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: summaryText },
        ],
        ctrl.signal,
      )

      if (!ctrl.signal.aborted) setResponse(reply)
    } catch (err) {
      if (ctrl.signal.aborted) return
      toast.error(t('ai.analysisError'))
      console.error(err)
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }

  if (!isConfigured) {
    return (
      <div className="rounded-xl border bg-muted/40 p-4 flex items-start gap-3">
        <BotMessageSquare size={18} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">{t('ai.panelTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('ai.notConfigured')}</p>
          <button
            onClick={() => navigate('/settings/ai-assistant')}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Settings size={12} />
            {t('ai.configure')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BotMessageSquare size={18} className="text-primary shrink-0" />
          <span className="font-medium text-sm">{t('ai.panelTitle')}</span>
        </div>
        <button
          onClick={() => { void handleAnalyze() }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {loading ? t('ai.analyzing') : t('ai.analyzeBtn', { period: currentPeriodLabel })}
        </button>
      </div>

      {response && (
        <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {response}
        </div>
      )}

      {!response && !loading && (
        <p className="text-xs text-muted-foreground">{t('ai.panelHint')}</p>
      )}
    </div>
  )
}
