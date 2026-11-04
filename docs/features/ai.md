# AI Integration

## Goal
Provide optional financial interpretation with user-owned provider credentials and no service cost to the application owner.

## Supported architecture
```text
AiAnalysisPanel
  → buildFinancialSummary
  → summaryToPrompt
  → AiProvider
       ├─ OpenAI-compatible
       ├─ LM Studio
       └─ Ollama
```
Additional providers require an adapter and tests without changing feature consumers.

## Privacy boundary
Adapters may receive only `FinancialSummary`. Never send raw transactions, descriptions, notes, account names, account IDs, individual transaction amounts or personal identifiers.

```ts
interface FinancialSummary {
  period: string
  baseCurrency: string
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
  byCategory: { categoryId: string; label: string; amount: number }[]
  budgetStatus: { categoryId: string; label: string; spent: number; limit: number; pct: number }[]
  topRecurring: { label: string; avgAmount: number; frequency: string }[]
  projection: { projectedMonthlyExpense: number; daysElapsed: number }
}
```
Category labels must be generic display labels, not user-provided sensitive text.

## Provider contract
Providers support full response and, when available, streaming with cancellation through `AbortSignal`. Raw provider errors are logged only after secret scrubbing and are never shown directly to users.

## Credentials
- User supplied and locally stored in IndexedDB settings.
- Sent only to the configured provider.
- Never logged, backed up, synchronized, placed in URLs or included in diagnostics.
- Webhooks require HTTPS; localhost HTTP is permitted only for local AI development.

## Prompt contract
System instructions must:
- analyze only the supplied aggregate;
- identify trends, anomalies and budget concerns;
- provide 3 to 5 concrete recommendations;
- avoid invented facts and authoritative financial calculations;
- remain under 400 words unless the user requests detail;
- state when data is insufficient.

Do not add the full project documentation, raw transaction history or previous analyses to the prompt.

## Context and token efficiency
- Send structured aggregates rather than prose duplication.
- Include only the requested scope and relevant comparison period.
- Do not request explanations for deterministic values already calculated by code.
- Cache successful analysis by period, scope, data revision, provider and model.
- Conversation context is session-scoped unless a future ADR approves persistence.

## Cache
- Persist analysis results in `aiAnalyses`.
- Retain for 12 months.
- Load at most 24 recent records into memory.
- Invalidate when scope or relevant data revision changes.
- Permit explicit refresh.

## Failure behavior
AI errors never block reports or core features. Cancellation is not an error. Offline state disables cloud providers while local providers may remain available.

## Required tests
- Sanitizer excludes prohibited fields.
- Date scopes crossing months retain the full range.
- Cancelled transactions are excluded.
- Streaming parsers handle partial chunks, termination and abort.
- Cache keys invalidate on scope and data changes.
- Credentials never appear in backup data or logs.

## Relevant files
- `src/lib/ai-provider.ts`
- `src/lib/ai-financial-summary.ts`
- provider adapter files under `src/lib/`
- `src/stores/ai-analyses.store.ts`
- `src/features/insights/components/AiAnalysisPanel.tsx`
