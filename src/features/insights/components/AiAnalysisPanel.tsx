import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bot, Sparkles, X, Settings, RefreshCw, Clock } from 'lucide-react'
import {
  format,
  subDays,
  formatDistanceToNow,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  startOfYear,
} from 'date-fns'
import { nanoid } from 'nanoid'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useBudgetsStore } from '@/stores/budgets.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useAiAnalysesStore } from '@/stores/ai-analyses.store'
import { AI_PROVIDER_OPTIONS, createAiProvider } from '@/lib/ai-provider'
import type { AiProviderConfig } from '@/lib/ai-provider'
import { buildFinancialSummary, summaryToPrompt } from '@/lib/ai-financial-summary'
import { Button } from '@/components/ui/button'

const SYSTEM_PROMPT = `You are a highly skilled personal finance analyst with expertise in budgeting, expense tracking, and financial planning. Your role is to provide clear, actionable insights based on aggregated financial data, focusing on identifying budget overruns, unusual spending patterns, and opportunities for savings. 

Your analysis should:
- Provide 3-5 specific, actionable recommendations based strictly on the data provided
- Focus on practical advice that can be implemented immediately to improve financial health and stability
- Highlight trends, anomalies, and areas requiring attention
- Be direct and professional, avoiding generic advice
- Keep your response under 400 words
- Use the transaction count and period information to contextualize your insights

The user will share an aggregated financial summary (no personal names, no account details, only category totals and budget metrics).`

type AnalysisScope =
  | 'current-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-quarter'
  | 'last-6-months'
  | 'last-year'
  | 30
  | 90
  | 365

/**
 * Calculate date range for a given analysis scope
 */
function getScopeRange(scope: AnalysisScope): { start: Date; end: Date } {
  const now = new Date()
  
  switch (scope) {
    case 'current-month':
      return { start: startOfMonth(now), end: now }
    
    case 'last-month': {
      const lastMonth = subMonths(now, 1)
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
    }
    
    case 'last-3-months':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
    
    case 'last-quarter': {
      const lastQuarter = subQuarters(now, 1)
      return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) }
    }
    
    case 'last-6-months':
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) }
    
    case 'last-year':
      return { start: startOfYear(subMonths(now, 11)), end: endOfMonth(now) }
    
    default:
      // Legacy day-based scopes (30, 90, 365)
      return { start: subDays(now, scope as number), end: now }
  }
}

/**
 * Generate human-friendly label for the analysis scope
 */
function getScopeLabel(scope: AnalysisScope, t: (key: string) => string): string {
  if (typeof scope === 'number') {
    return t(`insights.ai.scope${scope}`)
  }
  
  // Split by hyphen and capitalize each part: 'last-quarter' -> 'LastQuarter'
  const parts = scope.split('-')
  const capitalized = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
  return t(`insights.ai.scope${capitalized}`)
}

export default function AiAnalysisPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { transactions } = useTransactionsStore()
  const loadAllTransactions = useTransactionsStore((s) => s.load)
  const { categories } = useCategoriesStore()
  const { budgets } = useBudgetsStore()
  const { aiProvider, aiApiKey, aiBaseUrl, aiModel, baseCurrency } = useSettingsStore()
  const { analyses, load, add, getLatestForPeriod, cleanupOld } = useAiAnalysesStore()

  const [response, setResponse] = useState('')
  const [cachedAnalysis, setCachedAnalysis] = useState<{ analysis: ReturnType<typeof getLatestForPeriod>, age: string } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [scope, setScope] = useState<AnalysisScope>('last-3-months')
  const abortRef = useRef<AbortController | null>(null)

  const providerOption = AI_PROVIDER_OPTIONS.find((o) => o.value === aiProvider)
  const isConfigured = Boolean(
    aiProvider &&
      providerOption &&
      (!providerOption.requiresApiKey || aiApiKey.trim()),
  )

  const period = format(new Date(), 'yyyy-MM')
  const scopeButtonLabel = getScopeLabel(scope, t)

  // Load AI analyses on mount and cleanup old ones.
  // Also reload ALL transactions (no date filter) — TransactionListPage replaces
  // the store with a date-filtered slice; without this reload the analysis
  // would only see that limited subset. Matches the same pattern in DashboardPage.
  useEffect(() => {
    void loadAllTransactions()
    void load()
    void cleanupOld()
  }, [loadAllTransactions, load, cleanupOld])

  // Check for cached analysis when analyses or period changes
  useEffect(() => {
    const latest = getLatestForPeriod(period)
    if (latest) {
      setResponse(latest.response)
      setCachedAnalysis({
        analysis: latest,
        age: formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true }),
      })
    } else {
      setCachedAnalysis(null)
    }
  }, [period, analyses, getLatestForPeriod])

  // Clear cache when scope changes (user expects fresh analysis for different period)
  useEffect(() => {
    setCachedAnalysis(null)
    setResponse('')
  }, [scope])

  // Check if transactions changed since cached analysis
  const hasTransactionsChanged = () => {
    if (!cachedAnalysis?.analysis) return true
    
    const { start, end } = getScopeRange(scope)
    const startISO = start.toISOString()
    const endISO = end.toISOString()
    const recentTransactions = transactions.filter(
      (tx) => tx.date >= startISO && tx.date <= endISO
    )
    
    // If transaction count changed, data is stale
    return recentTransactions.length !== cachedAnalysis.analysis.transactionCount
  }

  async function handleAnalyze(forceRefresh = false) {
    if (!isConfigured || !providerOption) return

    // If cached and data hasn't changed, skip unless forced
    if (!forceRefresh && cachedAnalysis && !hasTransactionsChanged()) {
      toast.info(t('insights.ai.cacheStillValid'))
      return
    }

    setIsAnalyzing(true)
    setResponse('')
    setCachedAnalysis(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const { start, end } = getScopeRange(scope)
      const startISO = start.toISOString()
      const endISO = end.toISOString()
      // Filter transactions within the selected period (inclusive of both boundaries)
      const recentTransactions = transactions.filter(
        (tx) => tx.date >= startISO && tx.date <= endISO
      )

      const summary = buildFinancialSummary(
        recentTransactions,
        categories,
        budgets,
        baseCurrency,
        end,
        start, // custom start date for multi-period analysis
        end,   // custom end date
      )

      const config: AiProviderConfig = {
        type: providerOption.value,
        baseUrl: aiBaseUrl || providerOption.defaultBaseUrl,
        apiKey: aiApiKey.trim(),
        model: aiModel || 'gpt-4o-mini',
      }

      const ai = createAiProvider(config)
      
      // Generate meaningful period label
      const scopeLabel = getScopeLabel(scope, t)
      const prompt = summaryToPrompt(summary, recentTransactions.length, scopeLabel)
      
      // Use streaming to show response as it arrives
      let accumulatedResponse = ''
      await ai.chatStream(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        (chunk) => {
          accumulatedResponse += chunk
          setResponse(accumulatedResponse)
        },
        ctrl.signal,
      )

      // Persist to Dexie
      const analysis = {
        id: nanoid(),
        period,
        scopeDays: scope, // Store the full scope value (string or number)
        prompt,
        response: accumulatedResponse,
        provider: providerOption.value,
        model: aiModel || 'gpt-4o-mini',
        transactionCount: recentTransactions.length,
        createdAt: new Date().toISOString(),
      }
      await add(analysis)

      setCachedAnalysis({
        analysis,
        age: formatDistanceToNow(new Date(), { addSuffix: true }),
      })
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
    setCachedAnalysis(null)
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
            {/* Analysis Scope Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="scope-selector" className="text-xs font-medium text-muted-foreground">
                {t('insights.ai.analysisScope')}
              </label>
              <select
                id="scope-selector"
                value={scope}
                onChange={(e) => setScope(e.target.value as AnalysisScope)}
                className="text-xs border rounded px-2 py-1"
                disabled={isAnalyzing}
              >
                <option value="current-month">{t('insights.ai.scopeCurrentMonth')}</option>
                <option value="last-month">{t('insights.ai.scopeLastMonth')}</option>
                <option value="last-3-months">{t('insights.ai.scopeLast3Months')}</option>
                <option value="last-quarter">{t('insights.ai.scopeLastQuarter')}</option>
                <option value="last-6-months">{t('insights.ai.scopeLast6Months')}</option>
                <option value="last-year">{t('insights.ai.scopeLastYear')}</option>
                <option value={30}>{t('insights.ai.scope30')}</option>
                <option value={90}>{t('insights.ai.scope90')}</option>
                <option value={365}>{t('insights.ai.scope365')}</option>
              </select>
            </div>

            {/* Cached indicator */}
            {cachedAnalysis && !isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('insights.ai.analyzedAgo', { time: cachedAnalysis.age })}</span>
                {hasTransactionsChanged() && (
                  <span className="text-amber-600 font-medium">
                    • {t('insights.ai.dataChanged')}
                  </span>
                )}
              </div>
            )}

            {!response && !isAnalyzing && (
              <Button
                onClick={() => void handleAnalyze(false)}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                {t('insights.ai.analyzeButton', { period: scopeButtonLabel })}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('insights.ai.response')}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleAnalyze(true)}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t('insights.ai.refresh')}
                  </Button>
                </div>
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
