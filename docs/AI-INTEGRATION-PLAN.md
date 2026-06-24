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

| # | Question | Status |
|---|---|---|
| Q1 | Persist AI conversation history? (session-only vs. new Dexie table) | ✅ **Resolved** — Implemented in DB v9 (see below) |
| Q2 | Allow user-editable system prompt in Settings? | Open |
| Q3 | Receipt scanning via camera + vision model? (deferred — requires camera API) | Deferred |
| Q4 | MCP priority: Android Capacitor build or desktop PWA first? | Open |
| Q5 | Strict JSON schema validation on webhook responses? | Open |

---

## Persistence Implementation (Completed)

**Status:** Shipped in database version 9  
**Feature:** AI analysis results are cached in IndexedDB to avoid redundant AI calls and preserve insights across navigation.

### Schema Change

Added `aiAnalyses` table to `src/db/index.ts`:

```ts
.version(9).stores({
  aiAnalyses: 'id, period, createdAt'
})
```

**`AiAnalysis` interface** (in `src/types/index.ts`):

```ts
export interface AiAnalysis {
  id: string                    // nanoid
  period: string                // "YYYY-MM"
  scopeDays: 30 | 90 | 365      // analysis window
  prompt: string                // financial summary sent to AI
  response: string              // AI-generated text
  provider: string              // e.g. "openai"
  model: string                 // e.g. "gpt-4o-mini"
  transactionCount: number      // snapshot of tx count for cache invalidation
  createdAt: string             // ISO timestamp
}
```

### Store Layer

**`src/stores/ai-analyses.store.ts`** provides:

| Method | Behavior |
|---|---|
| `load()` | Loads last 24 analyses (2 years at 1/month) sorted by `createdAt` desc |
| `add(analysis)` | Persists new analysis to Dexie + prepends to in-memory state |
| `getLatestForPeriod(period)` | Returns most recent analysis for given period (e.g. "2026-04") or null |
| `cleanupOld()` | Deletes analyses older than 12 months; silent failure |

### Smart Cache Invalidation

**`AiAnalysisPanel`** checks cache freshness before re-analyzing:

1. **Cache hit:** If an analysis exists for the current period and `transactionCount` matches recent transaction count → show cached response
2. **Cache miss:** If count differs → prompt user with "new transactions" indicator
3. **Manual refresh:** User can force re-analysis via refresh button
4. **Scope selector:** User chooses 30/90/365-day analysis window; scope changes invalidate cache

### UI Enhancements

- **Analysis scope dropdown:** 30 / 90 / 365 days (default: 90)
- **Cache age indicator:** "Analyzed 3 hours ago" via `formatDistanceToNow` from `date-fns`
- **Data changed badge:** Shows "• new transactions" when cache is stale
- **Manual refresh button:** Forces new AI call even if cache is fresh
- **Persistence:** Analysis survives page reload and navigation

### Test Coverage

**`src/stores/ai-analyses.store.test.ts`** — 13 tests (100% store coverage):
- Load operations (sorting, limit, error handling)
- Add operations (Dexie + state sync, error handling)
- `getLatestForPeriod` (latest match, no match, empty state)
- Cleanup (12-month retention, no-op when all recent, silent error handling)

### Retention Policy

- **Auto-cleanup:** Triggered on `AiAnalysisPanel` mount via `useEffect`
- **Retention window:** 12 months from `createdAt`
- **Load limit:** Only last 24 analyses loaded into memory (reduces bundle weight on large histories)

### Data Preparation Fix (June 24, 2026)

**Issue:** `buildFinancialSummary()` in `src/lib/ai-financial-summary.ts` was filtering transactions to the reference month only, ignoring custom date ranges passed from the scope selector. When user selected a 30-day scope (e.g., May 25 - June 24), the function re-filtered to June 1-24, discarding May transactions. This resulted in zero income/expenses being sent to the AI, producing generic advice.

**Root Cause:** Lines 51-58 hard-coded `startOfMonth(referenceDate)` and `endOfMonth(referenceDate)` filtering, re-applying month boundaries to pre-filtered transaction arrays.

**Fix:** Added optional `customStartDate` and `customEndDate` parameters to `buildFinancialSummary()`. When provided:
- Uses custom date range instead of month boundaries for filtering
- Period label changes from `"YYYY-MM"` to `"YYYY-MM-DD to YYYY-MM-DD"`
- Projection logic adjusts to custom range length instead of days-in-month

**Caller Update:** `AiAnalysisPanel.handleAnalyze()` now passes:
```ts
const startDate = subDays(now, scopeDays)
buildFinancialSummary(transactions, categories, budgets, baseCurrency, now, startDate, now)
```

**Validation:** Added 5 new test cases in `ai-financial-summary.test.ts` covering:
- 30-day cross-month analysis (May 25 - June 24)
- Custom range period label formatting
- Projection to end of custom range (not end of month)
- Backward compatibility (monthly analysis when custom dates omitted)
- Cancelled transaction exclusion with custom dates

All 595 tests pass. Zero ESLint errors.

---

### Streaming & Enhanced Financial Expertise (June 24, 2026)

**Motivation:** Initial AI responses were slow (5-10 seconds with no feedback), generic (basic system prompt), and lacking context (transaction count, period labels). Users needed:
- Real-time feedback during analysis generation
- Expert-level financial insights instead of generic advice
- Richer context about their data (transaction volume, period type)

**Changes Implemented:**

#### 1. Enhanced System Prompt

Replaced the basic "concise personal finance assistant" prompt with a detailed financial expert role:

```ts
const SYSTEM_PROMPT = `You are a highly skilled personal finance analyst with expertise in budgeting, expense tracking, and financial planning. Your role is to provide clear, actionable insights based on aggregated financial data, focusing on identifying budget overruns, unusual spending patterns, and opportunities for savings. 

Your analysis should:
- Provide 3-5 specific, actionable recommendations based strictly on the data provided
- Focus on practical advice that can be implemented immediately to improve financial health and stability
- Highlight trends, anomalies, and areas requiring attention
- Be direct and professional, avoiding generic advice
- Keep your response under 400 words
- Use the transaction count and period information to contextualize your insights

The user will share an aggregated financial summary (no personal names, no account details, only category totals and budget metrics).`
```

**Impact:** AI now provides context-aware, actionable recommendations instead of generic financial tips.

#### 2. Streaming Response Support

Added `chatStream()` method to all three AI provider adapters (`ai-openai-adapter.ts`, `ai-lmstudio-adapter.ts`, `ai-ollama-adapter.ts`):

```ts
interface AiProvider {
  readonly id: string
  readonly label: string
  chat(messages: AiMessage[], signal?: AbortSignal): Promise<string>
  chatStream(messages: AiMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void>
}
```

**Implementation Details:**

| Adapter | Endpoint | Streaming Format |
|---|---|---|
| **OpenAI-compatible** | `POST /chat/completions` with `stream: true` | SSE with `data:` prefix, JSON chunks with `delta.content` |
| **LM Studio** | `POST /api/v1/chat` with `stream: true` | SSE with `data:` prefix, JSON chunks with `output[].content` |
| **Ollama** | `POST /api/chat` with `stream: true` | Newline-delimited JSON, chunks with `message.content`, `done` flag |

**AiAnalysisPanel Integration:**

```ts
let accumulatedResponse = ''
await ai.chatStream(
  [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ],
  (chunk) => {
    accumulatedResponse += chunk
    setResponse(accumulatedResponse)
  },
  ctrl.signal,
)
```

**User Experience:** Response text appears progressively as the AI generates it, providing immediate feedback and reducing perceived latency.

#### 3. Enhanced Financial Summary

Updated `summaryToPrompt()` to accept optional transaction count and period label:

```ts
export function summaryToPrompt(
  summary: FinancialSummary, 
  transactionCount?: number, 
  periodLabel?: string
): string
```

**New Context Fields:**
- `Transactions analyzed: ${transactionCount}` — Shows data volume for context
- `Financial Summary — ${periodLabel}` — Human-friendly period ("Current month", "Last quarter") instead of ISO dates

**Example Output:**

```
Financial Summary — Last 3 months
Base currency: MXN
Transactions analyzed: 127

Income:   12,500.00 MXN
Expenses: 8,340.00 MXN
Net:      4,160.00 MXN

Spending by category:
  Groceries: 2,100.00 MXN
  Transportation: 1,850.00 MXN
  Utilities: 980.00 MXN
  ...

Budget status:
  Groceries: 87% used (2,100.00 of 2,400.00)
  Transportation: 105% used (1,850.00 of 1,750.00)

Month-end projection: 11,120.00 MXN
(based on 24 days of data)
```

**Scope Label Helper:**

Added `getScopeLabel()` function to generate human-friendly labels for all analysis periods:
- `'current-month'` → "Current month"
- `'last-quarter'` → "Last quarter"
- `30` → "Last 30 days"

**Validation:**
- ✅ All 595 tests pass
- ✅ Zero ESLint errors
- ✅ Backward compatible with existing cached analyses
- ✅ All three streaming adapters tested (OpenAI-compatible, LM Studio, Ollama)

**Files Changed:**
- `src/features/insights/components/AiAnalysisPanel.tsx` — System prompt, streaming integration, scope labels
- `src/lib/ai-provider.ts` — Added `chatStream` to interface
- `src/lib/ai-openai-adapter.ts` — Streaming implementation with SSE parsing
- `src/lib/ai-lmstudio-adapter.ts` — Streaming with LM Studio-specific format
- `src/lib/ai-ollama-adapter.ts` — Streaming with Ollama JSON format
- `src/lib/ai-financial-summary.ts` — Enhanced `summaryToPrompt` with transaction count and period label

---
