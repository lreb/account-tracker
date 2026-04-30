// ─── AI Provider interface & factory ─────────────────────────────────────────
// Only openai-compatible and ollama are implemented in Phase 1.
// Anthropic, Gemini, and Webhook adapters are stubs deferred to Phase 2.

import { OpenAiCompatibleProvider } from './openai-adapter'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiProvider {
  readonly id: string
  readonly label: string
  chat(messages: AiMessage[], signal?: AbortSignal): Promise<string>
}

export type AiProviderType =
  | 'openai-compatible'
  | 'ollama'
  | 'anthropic'
  | 'gemini'
  | 'webhook'
  | ''

export type AiProviderConfig =
  | { type: 'openai-compatible'; baseUrl: string; apiKey: string; model: string }
  | { type: 'ollama'; baseUrl: string; model: string }
  | { type: 'anthropic'; apiKey: string; model: string }
  | { type: 'gemini'; apiKey: string; model: string }
  | { type: 'webhook'; url: string; secret?: string }

// Lazily import to avoid bundling all adapters unless needed.
export async function createAiProvider(config: AiProviderConfig): Promise<AiProvider> {
  switch (config.type) {
    case 'openai-compatible':
      return new OpenAiCompatibleProvider(config.baseUrl, config.apiKey, config.model)
    case 'ollama': {
      // Ollama speaks the OpenAI-compatible protocol on /v1
      const base = config.baseUrl.replace(/\/$/, '')
      return new OpenAiCompatibleProvider(`${base}/v1`, 'ollama', config.model)
    }
    default:
      throw new Error(`AI provider type "${(config as { type: string }).type}" is not yet implemented.`)
  }
}
