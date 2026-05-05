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

    // LM Studio /api/v1/chat is single-turn: one "input" string + optional "system_prompt".
    //   system_prompt → all system messages joined
    //   input         → the last role:'user' message (not the last non-system message,
    //                   which could be an assistant turn in a full chat history)
    //   prior turns   → prepended to system_prompt as a labelled transcript so context
    //                   is not silently discarded when a multi-turn history is passed in
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content)

    const conversationMessages = messages.filter((m) => m.role !== 'system')
    const lastUserIdx = [...conversationMessages].reverse().findIndex((m) => m.role === 'user')
    const lastUserContent =
      lastUserIdx >= 0
        ? conversationMessages[conversationMessages.length - 1 - lastUserIdx].content
        : ''

    // Build a transcript of all turns that precede the final user message so the
    // model has conversational context even though the API is single-turn.
    const priorTurns = conversationMessages.slice(
      0,
      conversationMessages.length - 1 - lastUserIdx,
    )
    const transcriptParts = priorTurns.map(
      (m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`,
    )

    const systemPromptParts = [
      ...systemParts,
      ...(transcriptParts.length > 0
        ? [`[Conversation so far]\n${transcriptParts.join('\n')}`]
        : []),
    ]

    const body: Record<string, string> = {
      model: this.model,
      input: lastUserContent,
    }
    if (systemPromptParts.length > 0) body.system_prompt = systemPromptParts.join('\n\n')

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
