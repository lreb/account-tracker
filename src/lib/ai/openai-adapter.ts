import type { AiMessage, AiProvider } from './ai-provider'

interface OpenAiChatResponse {
  choices: { message: { content: string } }[]
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id = 'openai-compatible'
  readonly label: string

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    this.label = `OpenAI-compatible (${new URL(baseUrl).hostname})`
  }

  async chat(messages: AiMessage[], signal?: AbortSignal): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // LM Studio and Ollama accept any non-empty string; real OpenAI needs a valid key.
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 512,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`)
    }

    const data = (await res.json()) as OpenAiChatResponse
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from AI provider.')
    return content.trim()
  }
}
