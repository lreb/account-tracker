// Adapter for Ollama's native /api/chat endpoint.
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
//
// Note: /api/chat accepts the same {role, content} message array as OpenAI.
// /api/generate is single-turn only and is NOT used here.
// Set stream:false to get a single JSON object instead of NDJSON chunks.

import type { AiMessage, AiProvider } from './ai-provider'

interface OllamaChatResponse {
  message: { role: string; content: string }
  done: boolean
}

export class OllamaAdapter implements AiProvider {
  readonly id = 'ollama'
  readonly label = 'Ollama'

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async chat(messages: AiMessage[], signal?: AbortSignal): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/api/chat`

    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
        signal,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          `Cannot reach Ollama at ${endpoint}. ` +
            `Make sure Ollama is running ('ollama serve') and accessible on port 11434.`,
        )
      }
      throw err
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }

    const data = (await res.json()) as OllamaChatResponse
    const content = data.message?.content
    if (!content) throw new Error('Empty response from Ollama')
    return content
  }
}
