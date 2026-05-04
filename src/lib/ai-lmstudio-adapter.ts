// Adapter for LM Studio's native REST API.
// Endpoint: POST /api/v1/chat  (not the OpenAI-compatible /v1/chat/completions)
// Docs: https://lmstudio.ai/docs/app/api
// Body: { model, input: AiMessage[] | string, max_tokens }  ("input" not "messages")

import type { AiMessage, AiProvider } from './ai-provider'

interface LmStudioResponseShape {
  output: Array<{ type: string; content: string }>
}

export class LmStudioAdapter implements AiProvider {
  readonly id = 'lm-studio'
  readonly label = 'LM Studio'

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async chat(messages: AiMessage[], signal?: AbortSignal): Promise<string> {
    // Strip any trailing /api/v1 or /v1 segments the user may have typed in,
    // then append the canonical LM Studio chat path.
    const origin = this.baseUrl.replace(/\/(api\/v1|v1)\/?$/, '').replace(/\/+$/, '')
    const endpoint = `${origin}/api/v1/chat`

    // LM Studio /api/v1/chat: system messages go in top-level "system_prompt";
    // conversational turns use { type: 'message', content } — no "role" field.
    const systemPrompt = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n')
    const inputMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ type: 'message', content: m.content }))

    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          ...(systemPrompt ? { system_prompt: systemPrompt } : {}),
          input: inputMessages,
        }),
        signal,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          `Cannot reach LM Studio at ${endpoint}. ` +
            `Make sure LM Studio is running, the local server is enabled, ` +
            `and CORS is enabled in LM Studio → Settings → Local Server → Enable CORS.`,
        )
      }
      throw err
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LM Studio error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }

    const data = (await res.json()) as LmStudioResponseShape
    const content = data.output?.find((item) => item.type === 'message')?.content
    if (!content) throw new Error('Empty response from LM Studio')
    return content
  }
}
