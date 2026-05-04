// AI provider abstraction.
// Phase 1 ships with the OpenAI-compatible adapter (OpenAI, Groq, Together AI)
// and a dedicated LM Studio adapter using its native /api/v1/chat endpoint.
// Anthropic, Gemini, and Ollama adapters are planned for Phase 2.

import { OpenAiCompatibleAdapter } from './ai-openai-adapter'
import { LmStudioAdapter } from './ai-lmstudio-adapter'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiProvider {
  readonly id: string
  readonly label: string
  chat(messages: AiMessage[], signal?: AbortSignal): Promise<string>
}

// The wire protocol differs per provider: 'openai-compatible' uses /v1/chat/completions;
// 'lm-studio' uses its native /api/v1/chat endpoint.
export type AiProviderType = 'openai-compatible' | 'lm-studio'

export interface AiProviderConfig {
  type: AiProviderType
  baseUrl: string
  apiKey: string
  model: string
}

export const AI_PROVIDER_OPTIONS: readonly {
  value: AiProviderType
  label: string
  defaultBaseUrl: string
  requiresApiKey: boolean
}[] = [
  {
    value: 'openai-compatible',
    label: 'OpenAI / Compatible (Groq, Together AI…)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
  },
  {
    value: 'lm-studio',
    label: 'LM Studio (local)',
    defaultBaseUrl: 'http://localhost:1234',
    requiresApiKey: false,
  },
]

export function createAiProvider(config: AiProviderConfig): AiProvider {
  switch (config.type) {
    case 'openai-compatible':
      return new OpenAiCompatibleAdapter(config.baseUrl, config.apiKey, config.model)
    case 'lm-studio':
      // LM Studio uses /api/v1/chat, not the OpenAI /chat/completions path.
      // No API key required; model name comes from what's loaded in LM Studio.
      return new LmStudioAdapter(config.baseUrl, config.model)
    default: {
      const _exhaustive: never = config.type
      throw new Error(`Unknown AI provider type: ${String(_exhaustive)}`)
    }
  }
}

