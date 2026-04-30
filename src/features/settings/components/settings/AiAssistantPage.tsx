import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, BotMessageSquare } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { createAiProvider } from '@/lib/ai/ai-provider'
import type { AiProviderType } from '@/lib/ai/ai-provider'

const PROVIDER_OPTIONS: { value: AiProviderType; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI / LM Studio / Groq (OpenAI-compatible)' },
  { value: 'ollama', label: 'Ollama (local)' },
]

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  'openai-compatible': { baseUrl: 'http://localhost:1234/v1', model: '' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' },
}

type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

export default function AiAssistantPage() {
  const { t } = useTranslation()
  const { aiProvider, aiApiKey, aiBaseUrl, aiModel, saveSetting } = useSettingsStore()

  const [provider, setProvider] = useState<AiProviderType>((aiProvider as AiProviderType) || 'openai-compatible')
  const [apiKey, setApiKey] = useState(aiApiKey)
  const [baseUrl, setBaseUrl] = useState(aiBaseUrl || PROVIDER_DEFAULTS['openai-compatible'].baseUrl)
  const [model, setModel] = useState(aiModel)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')
  const [saving, setSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const needsBaseUrl = provider === 'openai-compatible' || provider === 'ollama'
  const needsApiKey = provider === 'openai-compatible'

  function handleProviderChange(value: AiProviderType) {
    setProvider(value)
    const defaults = PROVIDER_DEFAULTS[value]
    if (defaults) {
      setBaseUrl(defaults.baseUrl)
      setModel(defaults.model)
    }
    setTestStatus('idle')
  }

  async function handleSave() {
    setSaving(true)
    await Promise.all([
      saveSetting('aiProvider', provider),
      saveSetting('aiApiKey', apiKey),
      saveSetting('aiBaseUrl', baseUrl),
      saveSetting('aiModel', model),
    ])
    setSaving(false)
  }

  async function handleTest() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setTestStatus('loading')
    setTestError('')

    try {
      let config
      if (provider === 'openai-compatible') {
        config = { type: 'openai-compatible' as const, baseUrl, apiKey, model: model || 'default' }
      } else if (provider === 'ollama') {
        config = { type: 'ollama' as const, baseUrl, model: model || 'llama3' }
      } else {
        throw new Error(t('ai.providerNotImplemented'))
      }

      const p = await createAiProvider(config)
      const reply = await p.chat(
        [{ role: 'user', content: 'Reply with the single word: OK' }],
        ctrl.signal,
      )
      if (ctrl.signal.aborted) return
      if (reply.trim().toUpperCase().includes('OK') || reply.trim().length > 0) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError(t('ai.testEmptyResponse'))
      }
    } catch (err) {
      if (ctrl.signal.aborted) return
      setTestStatus('error')
      setTestError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="p-4 pb-24 space-y-5 max-w-xl mx-auto">
      <div className="flex items-center gap-2">
        <BotMessageSquare size={20} className="text-primary" />
        <h1 className="text-xl font-bold">{t('ai.title')}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t('ai.description')}</p>

      <div className="rounded-2xl border bg-white divide-y space-y-0 overflow-hidden">

        {/* Provider */}
        <div className="px-4 py-3 space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('ai.provider')}
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProviderType)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Base URL */}
        {needsBaseUrl && (
          <div className="px-4 py-3 space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('ai.baseUrl')}
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">{t('ai.baseUrlHint')}</p>
          </div>
        )}

        {/* Model */}
        <div className="px-4 py-3 space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('ai.model')}
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={t('ai.modelPlaceholder')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">{t('ai.modelHint')}</p>
        </div>

        {/* API Key */}
        {needsApiKey && (
          <div className="px-4 py-3 space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('ai.apiKey')} <span className="text-muted-foreground font-normal normal-case">({t('ai.apiKeyOptional')})</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('ai.apiKeyPlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t('ai.apiKeyHint')}</p>
          </div>
        )}
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { void handleTest() }}
          disabled={testStatus === 'loading' || !baseUrl || !model}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {testStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}
          {t('ai.testConnection')}
        </button>

        {testStatus === 'ok' && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
            <CheckCircle2 size={14} /> {t('ai.testOk')}
          </span>
        )}
        {testStatus === 'error' && (
          <span className="flex items-center gap-1 text-sm text-red-500 font-medium">
            <XCircle size={14} /> {t('ai.testFailed')}
          </span>
        )}
      </div>

      {testStatus === 'error' && testError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {testError}
        </p>
      )}

      {/* Save */}
      <button
        onClick={() => { void handleSave() }}
        disabled={saving}
        className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {t('ai.save')}
      </button>

      {/* Privacy notice */}
      <p className="text-xs text-muted-foreground text-center px-4">
        {t('ai.privacyNotice')}
      </p>
    </div>
  )
}
