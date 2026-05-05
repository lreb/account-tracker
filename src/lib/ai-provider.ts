// AI provider abstraction.
// Phase 1: OpenAI-compatible (OpenAI, Groq, Together AI), LM Studio, Ollama.
// Anthropic and Gemini adapters are planned for Phase 2.

import { OpenAiCompatibleAdapter } from './ai-openai-adapter'
import { LmStudioAdapter } from './ai-lmstudio-adapter'
import { OllamaAdapter } from './ai-ollama-adapter'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiProvider {
  readonly id: string
  readonly label: string
  chat(messages: AiMessage[], signal?: AbortSignal): Promise<string>
}

// Wire protocols:
//   openai-compatible → POST /v1/chat/completions
//   lm-studio         → POST /api/v1/chat (native LM Studio endpoint)
//   ollama            → POST /api/chat   (Ollama native, stream:false)
export type AiProviderType = 'openai-compatible' | 'lm-studio' | 'ollama'

export interface AiProviderConfig {
  type: AiProviderType
  baseUrl: string
  apiKey: string   // empty string for providers that do not require a key
  model: string
}

export const AI_PROVIDER_OPTIONS: readonly {
  value: AiProviderType
  label: string
  defaultBaseUrl: string
  requiresApiKey: boolean
  /** i18n key for the setup hint shown below Base URL for local providers */
  localHintKey?: string
  /** Placeholder shown in the Model field for this provider */
  modelPlaceholder: string
}[] = [
  {
    value: 'openai-compatible',
    label: 'ai.aiProviderOpenaiCompatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    modelPlaceholder: 'ai.aiModelPlaceholderOpenai',
  },
  {
    value: 'lm-studio',
    label: 'ai.aiProviderLmStudio',
    defaultBaseUrl: 'http://localhost:1234',
    requiresApiKey: false,
    localHintKey: 'ai.aiLocalProviderHint',
    modelPlaceholder: 'ai.aiModelPlaceholderLmStudio',
  },
  {
    value: 'ollama',
    label: 'ai.aiProviderOllama',
    defaultBaseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    localHintKey: 'ai.aiOllamaHint',
    modelPlaceholder: 'ai.aiModelPlaceholderOllama',
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
    case 'ollama':
      // Ollama /api/chat accepts the same {role,content} message array as OpenAI.
      // No API key required; pass the model name exactly as shown in 'ollama list'.
      return new OllamaAdapter(config.baseUrl, config.model)
    default: {
      const _exhaustive: never = config.type
      throw new Error(`Unknown AI provider type: ${String(_exhaustive)}`)
    }
  }
}

