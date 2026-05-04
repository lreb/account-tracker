import type { AiMessage, AiProvider } from './ai-provider'

interface OpenAiResponseShape {
  choices: Array<{ message: { content: string } }>
}

export class OpenAiCompatibleAdapter implements AiProvider {
  readonly id = 'openai-compatible'
  readonly label = 'OpenAI / Compatible'

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async chat(messages: AiMessage[], signal?: AbortSignal): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`

    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, messages, max_tokens: 1000 }),
        signal,
      })
    } catch (err) {
      // fetch() rejects with a TypeError on network failure or CORS block.
      // Give a specific message so the user knows to check CORS / server status.
      if (err instanceof TypeError) {
        throw new Error(
          `Cannot reach ${endpoint}. ` +
            `If using a local provider (LM Studio, Ollama), make sure the server is running ` +
            `and CORS is enabled in its settings.`,
        )
      }
      throw err
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`AI API error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }

    const data = (await res.json()) as OpenAiResponseShape
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from AI provider')
    return content
  }
}
