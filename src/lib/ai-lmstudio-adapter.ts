// Adapter for LM Studio's native REST API.
// Endpoint: POST /api/v1/chat  (not the OpenAI-compatible /v1/chat/completions)
// Docs: https://lmstudio.ai/docs/app/api
//
// Confirmed working request format (Postman):
//   { model, system_prompt?, input: "user message string" }
// Response:
//   { output: [{type: 'message', content: '...'}], model_instance_id, stats, response_id }
//
// Note: "input" must be a plain string — NOT an array of message objects.
// "output" IS an array of typed content blocks; we pick the first 'message' block.

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

    // LM Studio /api/v1/chat format:
    //   system_prompt (optional) → top-level string field
    //   input → last user message as a plain string
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content)
    const userMessages = messages.filter((m) => m.role !== 'system')
    const lastUserContent = userMessages[userMessages.length - 1]?.content ?? ''

    const body: Record<string, string> = {
      model: this.model,
      input: lastUserContent,
    }
    if (systemParts.length > 0) body.system_prompt = systemParts.join('\n')

    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          `Cannot reach LM Studio at ${endpoint}. ` +
            `Make sure LM Studio is running, the local server is enabled (port 1234), ` +
            `and CORS is enabled: LM Studio → Settings → Local Server → Enable CORS.`,
        )
      }
      throw err
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LM Studio error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }

    const data = (await res.json()) as LmStudioResponseShape
    const content = data.output?.find((item) => item.type === 'message')?.content?.trim()
    if (!content) throw new Error('Empty response from LM Studio')
    return content
  }
}
