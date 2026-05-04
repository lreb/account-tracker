import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Eye, EyeOff, Bot } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AI_PROVIDER_OPTIONS, createAiProvider } from '@/lib/ai-provider'
import type { AiProviderConfig, AiProviderType } from '@/lib/ai-provider'

export default function AiSettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { saveSetting, aiProvider, aiApiKey, aiBaseUrl, aiModel } = useSettingsStore()

  const [provider, setProvider] = useState<AiProviderType>(
    (aiProvider as AiProviderType) || 'openai-compatible',
  )
  const [apiKey, setApiKey] = useState(aiApiKey)
  const [baseUrl, setBaseUrl] = useState(aiBaseUrl || 'https://api.openai.com/v1')
  const [model, setModel] = useState(aiModel || 'gpt-4o-mini')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  const selectedOption = AI_PROVIDER_OPTIONS.find((o) => o.value === provider)
  const requiresApiKey = selectedOption?.requiresApiKey ?? true

  function handleProviderChange(v: string | null) {
    if (!v) return
    const next = v as AiProviderType
    const option = AI_PROVIDER_OPTIONS.find((o) => o.value === next)
    setProvider(next)
    setTestStatus('idle')
    // Auto-fill base URL when switching to a provider with a known default
    if (option) setBaseUrl(option.defaultBaseUrl)
    // Clear API key hint when switching to a local provider that doesn't need one
    if (option && !option.requiresApiKey) setApiKey('')
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await Promise.all([
        saveSetting('aiProvider', provider),
        saveSetting('aiApiKey', apiKey),
        saveSetting('aiBaseUrl', baseUrl),
        saveSetting('aiModel', model),
      ])
      toast.success(t('settings.aiSaved'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTest() {
    if (requiresApiKey && !apiKey.trim()) {
      toast.error(t('settings.aiApiKeyRequired'))
      return
    }
    setIsTesting(true)
    setTestStatus('idle')
    const ctrl = new AbortController()
    try {
      const config: AiProviderConfig = {
        type: provider,
        baseUrl: baseUrl.trim() || selectedOption?.defaultBaseUrl || 'https://api.openai.com/v1',
        apiKey: apiKey.trim(),
        model: model.trim() || 'gpt-4o-mini',
      }
      const ai = createAiProvider(config)
      await ai.chat([{ role: 'user', content: 'Reply with OK' }], ctrl.signal)
      setTestStatus('ok')
      toast.success(t('settings.aiTestSuccess'))
    } catch {
      setTestStatus('fail')
      toast.error(t('settings.aiTestFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="p-4 pb-24 space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">{t('settings.aiAssistantTitle')}</h1>
      </div>

      {/* Configuration */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
        {t('settings.aiSectionConfig')}
      </p>

      <div className="rounded-2xl border overflow-hidden bg-card divide-y">
        {/* Provider */}
        <div className="px-4 py-3 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('settings.aiProvider')}
          </label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key — hidden for local providers that don't require one */}
        {requiresApiKey && (
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('settings.aiApiKey')}
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTestStatus('idle')
                }}
                placeholder={t('settings.aiApiKeyPlaceholder')}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted hover:bg-accent"
                aria-label={showKey ? t('settings.aiHideKey') : t('settings.aiShowKey')}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Model */}
        <div className="px-4 py-3 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('settings.aiModel')}
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={t('settings.aiModelPlaceholder')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Base URL */}
        <div className="px-4 py-3 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('settings.aiBaseUrl')}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('settings.aiBaseUrlPlaceholder')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          />
          {!requiresApiKey && (
            <p className="text-xs text-muted-foreground">{t('settings.aiLocalProviderHint')}</p>
          )}
        </div>
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-2 rounded-xl border bg-muted/50 px-4 py-3">
        <Bot className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t('settings.aiKeyNote')}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => void handleTest()}
          disabled={isTesting || (requiresApiKey && !apiKey.trim())}
          className="flex-1"
        >
          {isTesting
            ? t('settings.aiTestConnecting')
            : testStatus === 'ok'
              ? `✓ ${t('settings.aiTestSuccess')}`
              : testStatus === 'fail'
                ? `✗ ${t('settings.aiTestFailed')}`
                : t('settings.aiTestConnection')}
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="flex-1"
        >
          {isSaving ? t('common.loading') : t('common.save')}
        </Button>
      </div>
    </div>
  )
}
