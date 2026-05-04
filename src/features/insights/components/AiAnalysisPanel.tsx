import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bot, Sparkles, X, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useSettingsStore } from '@/stores/settings.store'
import { AI_PROVIDER_OPTIONS, createAiProvider } from '@/lib/ai-provider'
import type { AiProviderConfig } from '@/lib/ai-provider'
import { buildFinancialSummary, summaryToPrompt } from '@/lib/ai-financial-summary'
import { Button } from '@/components/ui/button'

const SYSTEM_PROMPT = `You are a concise personal finance assistant. 
The user will share an aggregated financial summary (no names, no account details). 
Provide 3–5 specific, actionable insights based strictly on the data. 
Focus on budget overruns, unusual spending patterns, and savings opportunities. 
Be direct and practical. Keep your response under 300 words.`

export default function AiAnalysisPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { budgets } = useBudgetsStore()
  const { aiProvider, aiApiKey, aiBaseUrl, aiModel, baseCurrency } = useSettingsStore()

  const [response, setResponse] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const providerOption = AI_PROVIDER_OPTIONS.find((o) => o.value === aiProvider)
  const isConfigured = Boolean(
    aiProvider &&
      providerOption &&
      (!providerOption.requiresApiKey || aiApiKey),
  )

  const period = useMemo(() => format(new Date(), 'MMMM yyyy'), [])

  async function handleAnalyze() {
    if (!isConfigured) return

    setIsAnalyzing(true)
    setResponse('')
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const summary = buildFinancialSummary(
        transactions,
        categories,
        budgets,
        baseCurrency,
        new Date(),
      )

      const config: AiProviderConfig = {
        type: (aiProvider as AiProviderConfig['type']) || 'openai-compatible',
        baseUrl: aiBaseUrl || providerOption?.defaultBaseUrl || 'https://api.openai.com/v1',
        apiKey: aiApiKey,
        model: aiModel || 'gpt-4o-mini',
      }

      const ai = createAiProvider(config)
      const result = await ai.chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: summaryToPrompt(summary) },
        ],
        ctrl.signal,
      )

      setResponse(result)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error(err)
      toast.error(t('insights.ai.errorGeneric'))
    } finally {
      setIsAnalyzing(false)
      abortRef.current = null
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    setIsAnalyzing(false)
  }

  function handleClear() {
    setResponse('')
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{t('insights.ai.title')}</span>
      </div>

      <div className="p-4 space-y-3">
        {!isConfigured ? (
          /* Not configured state */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('insights.ai.configureHint')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/ai-assistant')}
              className="flex items-center gap-2"
            >
              <Settings className="h-3.5 w-3.5" />
              {t('insights.ai.configureAction')}
            </Button>
          </div>
        ) : (
          /* Configured state */
          <div className="space-y-3">
            {!response && !isAnalyzing && (
              <Button
                onClick={() => void handleAnalyze()}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                {t('insights.ai.analyzeButton', { period })}
              </Button>
            )}

            {isAnalyzing && (
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">{t('insights.ai.analyzing')}</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('insights.ai.cancel')}
                </button>
              </div>
            )}

            {response && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('insights.ai.response')}
                </p>
                <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {response}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('insights.ai.newAnalysis')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
