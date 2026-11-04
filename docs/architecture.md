# Architecture

## System
ExpenseTracking is a client-side PWA with no required backend.

```text
React UI
   ↓
Zustand stores
   ↓
Pure domain utilities
   ↓
Dexie
   ↓
IndexedDB
```

Optional user-triggered network integrations:
- Frankfurter v2 for exchange rates. `src/stores/exchange-rates.store.ts` calls `https://api.frankfurter.dev/v2/rates?base=` and `https://api.frankfurter.dev/v2/rate/{from}/{to}`.
- User-selected cloud backup provider
- User-configured AI provider

## Layer responsibilities
### UI
Renders state, captures input and calls store actions. It does not call Dexie or contain authoritative financial calculations.

### Stores
Own application state and mutation workflows. Store mutations validate input, persist to Dexie, update memory and surface sanitized errors.

### Domain utilities
Pure functions for balances, budgets, currency conversion, reporting, retention aggregation and AI data preparation.

### Persistence
Dexie is the only IndexedDB abstraction. Each structural change adds a new immutable schema version.

## Source layout
```text
src/
  app/                 application shell and router
  components/ui/       shared UI primitives
  components/layout/   shell and navigation
  features/<domain>/   feature UI, hooks, schemas and local types
  stores/              Zustand domain stores
  db/                  Dexie schema and migrations
  lib/                 pure domain utilities and integrations
  hooks/               hooks shared by 2+ features
  types/               types shared by 2+ features
  i18n/                English and Spanish resources
```

## Data flow
```text
User action
  → Zod/form validation
  → Zustand action
  → pure business rule
  → Dexie transaction
  → in-memory state update
  → UI rerender
```

If persistence fails, do not leave memory in a successful state. Display a localized, non-sensitive error.

## Date / Time Handling
- Persist transaction instants as UTC ISO strings.
- Build date-range boundaries in device-local time, then convert to ISO when string comparison requires UTC.
- Do not append `Z` to a user-selected local day boundary before constructing the Date.

```ts
const from = new Date(`${dateFrom}T00:00:00.000`).toISOString()
const to = new Date(`${dateTo}T23:59:59.999`).toISOString()
```

This preserves the user's local calendar day and avoids excluding late-night entries.

## Money and currency
- Monetary values use integer minor units.
- Exchange rates may use decimal numbers with explicit rounding at the money boundary.
- Reports convert values into the selected base currency at read time.
- Missing rates must produce an unavailable state, never a mislabeled unconverted value.

## Performance
Apply optimizations after measuring. Existing approved patterns include route-level splitting, virtualized long lists, memoized pure calculations and deferred rendering for expensive reporting views.

## PWA
Vite PWA Plugin generates the service worker and manifest. Core data operations must work offline. Network integrations degrade without blocking the core application.
