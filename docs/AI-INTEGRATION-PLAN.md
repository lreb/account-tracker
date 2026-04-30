# AI Integration Plan — ExpenseTracking

> Status: Planning · Last updated: 2026-04-30  
> Goal: Let each user plug in their own AI provider so the app gains intelligent guidance with **zero service cost to the app owner**.

---

## Guiding Principles

| Principle | Detail |
|---|---|
| **BYOK / BYOA** | Bring Your Own Key / Agent — no API key is ever bundled; the user owns the cost |
| **Zero telemetry** | No financial data leaves the device unless the user explicitly triggers an AI call |
| **Offline-first stays intact** | All AI features are additive opt-ins; every core feature works without them |
| **Provider-agnostic** | The integration layer is swappable; adding a new provider must not require app changes |
| **Minimal data surface** | Only aggregated summaries are sent to AI — never raw descriptions, account names, or balances |

---

## Integration Options Evaluated

### Tier A — Cloud API (user-supplied key)

| Provider | Protocol | Notes |
|---|---|---|
| **OpenAI** (GPT-4o, GPT-4o-mini) | REST / OpenAI SDK | Most common; `gpt-4o-mini` is cheapest |
| **Anthropic** (Claude 3.x) | REST / Anthropic SDK | Strong reasoning |
| **Google Gemini** | REST / Google AI SDK | Free tier available |
| **Mistral AI** | REST / Mistral SDK | EU-hosted; GDPR-friendlier |
| **OpenAI-compatible endpoints** | REST (OpenAI schema) | Covers Groq, Together AI, Perplexity via one adapter |

**Recommended default:** OpenAI-compatible adapter (one code path covers all compatible providers).

### Tier B — Local / On-device AI

| Provider | Protocol | Notes |
|---|---|---|
| **Ollama** | Local HTTP (`http://localhost:11434`) | User runs locally; zero data leaves device |
| **LM Studio** | Local HTTP (OpenAI-compatible) | GUI-based; same adapter as OpenAI |
| **WebLLM / Transformers.js** | In-browser (WASM) | No server; models > 3 GB impractical in a PWA |

### Tier C — MCP (Model Context Protocol)

Instead of sending a text summary, the app exposes typed tool endpoints and a connected MCP client (Claude Desktop, Cursor, custom agent) calls them.

| Variant | Implementation |
|---|---|
| **MCP over SSE / WebSocket** | App opens a local WebSocket server (Capacitor/desktop only) |
| **MCP via postMessage** | If app is embedded in an MCP-aware shell (future) |

> MCP is viable only in the Capacitor (Android/desktop) packaging. Deferred to v1.3+.

### Tier D — Webhook / Custom Endpoint

User supplies any HTTPS endpoint that accepts a JSON POST and returns a text response. Integrates with n8n, Make.com, LangChain agents, Azure AI Foundry, AWS Bedrock, etc.

---

## Recommended Architecture

```
src/
├── lib/
│   └── ai/
│       ├── ai-provider.ts          # Provider interface + factory
│       ├── openai-adapter.ts       # OpenAI / OpenAI-compatible
│       ├── anthropic-adapter.ts    # Anthropic
│       ├── gemini-adapter.ts       # Google Gemini
│       ├── ollama-adapter.ts       # Ollama (local)
│       ├── webhook-adapter.ts      # Generic HTTP webhook
│       └── financial-summary.ts   # buildFinancialSummary() — data sanitizer
├── stores/
│   └── settings.store.ts           # aiProvider, aiApiKey, aiBaseUrl, aiModel
└── features/
    ├── insights/
    │   └── components/
    │       └── AiAnalysisPanel.tsx  # "Analyze with AI" UI
    └── settings/
        └── components/
            └── AiSettingsSection.tsx  # Provider picker + key + test
```

### Provider Interface

```ts
// src/lib/ai/ai-provider.ts
export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiProvider {
  readonly id: string
  readonly label: string
  chat(messages: AiMessage[], signal?: AbortSignal): Promise<string>
}

export type AiProviderConfig =
  | { type: 'openai-compatible'; baseUrl: string; apiKey: string; model: string }
  | { type: 'anthropic';         apiKey: string; model: string }
  | { type: 'gemini';            apiKey: string; model: string }
  | { type: 'ollama';            baseUrl: string; model: string }
  | { type: 'webhook';           url: string; secret?: string }

export function createAiProvider(config: AiProviderConfig): AiProvider { /* factory */ }
```

### Data Sanitizer — `buildFinancialSummary()`

The mandatory privacy gate before any AI call:

```ts
// src/lib/ai/financial-summary.ts
export interface FinancialSummary {
  period: string                // e.g. "2026-04"
  baseCurrency: string
  totalIncome: number           // cents
  totalExpenses: number
  netCashFlow: number
  byCategory: { categoryId: string; label: string; amount: number }[]
  budgetStatus: { categoryId: string; label: string; spent: number; limit: number; pct: number }[]
  topRecurring: { label: string; avgAmount: number; frequency: string }[]
  projection: { projectedMonthlyExpense: number; daysElapsed: number }
}
```

**Never included:** raw descriptions, notes, account names, account IDs, individual amounts, labels, or personal identifiers.

---

## Settings Schema Changes

New keys in the `settings` Dexie table (no migration needed — key/value store):

| Key | Description |
|---|---|
| `aiProvider` | `'openai-compatible' \| 'anthropic' \| 'gemini' \| 'ollama' \| 'webhook' \| ''` |
| `aiApiKey` | API key (stored locally; only sent to the chosen provider) |
| `aiBaseUrl` | Base URL override (Ollama, LM Studio, OpenAI-compatible proxy) |
| `aiModel` | Model name (e.g. `gpt-4o-mini`, `llama3`, `claude-3-haiku-20240307`) |
| `aiWebhookUrl` | Webhook endpoint (Tier D only) |
| `aiWebhookSecret` | Optional bearer token for webhook |

`useSettingsStore.saveSetting(key, value)` already handles arbitrary keys — no store changes needed.

---

## UI Plan

### Settings → AI Assistant (new section under `/settings`)

```
┌─────────────────────────────────────────────┐
│  AI Assistant                               │
│                                             │
│  Provider          [OpenAI ▾]               │
│  API Key           [••••••••••••]  [Show]   │
│  Model             [gpt-4o-mini]            │
│  Base URL          [https://api.openai.com] │
│  (shown only for openai-compatible/ollama)  │
│                                             │
│  [Test Connection]   ✓ Connected            │
│                                             │
│  ℹ Your key is stored only on this device.  │
│    It is sent directly to the provider.     │
└─────────────────────────────────────────────┘
```

### Insights Page — "Analyze with AI" Panel

```
┌─────────────────────────────────────────────┐
│  🤖 AI Analysis                             │
│                                             │
│  [Analyze April 2026 ▸]                     │
│                                             │
│  ── Response ─────────────────────────────  │
│  Your restaurant spending this month is     │
│  34% above your 3-month average…            │
└─────────────────────────────────────────────┘
```

- Button disabled + tooltip "Configure AI in Settings" when no provider is set
- `AbortController` cancels in-flight requests on unmount or user cancel
- Responses streamed token-by-token where provider supports it (OpenAI SSE, Ollama stream)
- Errors surface via `toast.error()` — no raw API error messages shown

---

## Phased Rollout

### Phase 1 — Foundation (v1.2)

| Task | File |
|---|---|
| `AiProvider` interface + factory | `src/lib/ai/ai-provider.ts` |
| OpenAI-compatible adapter | `src/lib/ai/openai-adapter.ts` |
| `buildFinancialSummary()` + unit tests | `src/lib/ai/financial-summary.ts` |
| Settings UI — provider picker + key input | `AiSettingsSection.tsx` |
| "Analyze with AI" button in Insights (full-response) | `AiAnalysisPanel.tsx` |

### Phase 2 — More Providers + Streaming (v1.3)

| Task |
|---|
| Anthropic adapter |
| Gemini adapter |
| Ollama adapter (auto-detects `http://localhost:11434`) |
| Streaming responses (OpenAI SSE → token-by-token render) |
| Conversation context (last N turns, session-only) |

### Phase 3 — MCP & Webhook (v1.4+)

| Task |
|---|
| Webhook adapter (any HTTPS POST endpoint) |
| MCP tool exposure for Capacitor build (`getFinancialSummary`, `getBudgetStatus`, `getInsights`) |
| User-editable saved prompts (stored in `settings` as JSON) |

---

## Security Requirements

- API keys stored **only in IndexedDB** — never in `localStorage`, cookies, or URL params
- Keys are **never logged**, never included in error reports, never sent anywhere except the configured provider
- All AI calls made **client-side only** — no proxy server
- Webhook calls require HTTPS; `http://` is rejected unless `localhost` (Ollama dev use)
- `buildFinancialSummary()` is the **mandatory data gate** — adapters receive only its output, never raw Dexie records
- "Test Connection" sends the fixed prompt `"Reply with OK"` — no user data involved

---

## Open Questions

| # | Question |
|---|---|
| Q1 | Persist AI conversation history? (session-only vs. new Dexie table) |
| Q2 | Allow user-editable system prompt in Settings? |
| Q3 | Receipt scanning via camera + vision model? (deferred — requires camera API) |
| Q4 | MCP priority: Android Capacitor build or desktop PWA first? |
| Q5 | Strict JSON schema validation on webhook responses? |
