# Architecture Overview

## System Design

**ExpenseTracking** is a local-first, offline-first Progressive Web App (PWA) with zero backend dependency. All data lives in the user's device via IndexedDB.

### Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (React Components + shadcn/ui)            │
├─────────────────────────────────────────────────────┤
│  State Management (Zustand stores)                  │
├─────────────────────────────────────────────────────┤
│  Data Persistence (Dexie.js / IndexedDB)            │
├─────────────────────────────────────────────────────┤
│  Utility & Business Logic (src/lib/)                │
└─────────────────────────────────────────────────────┘
```

### Core Principles

1. **Offline-First**: Every feature works without internet; sync is optional and user-triggered
2. **Local-First**: No data leaves the device without explicit user action
3. **Single Responsibility**: Each module owns its domain (transactions, vehicles, budgets, reports, etc.)
4. **Type Safety**: Strict TypeScript throughout; zero any-types
5. **Performance**: Virtual lists, memoization, code splitting by route

### Module Organization

```
src/
├── app/                    # Root component & routing setup
├── components/
│   ├── ui/                 # Primitive UI components (shadcn/ui + custom)
│   └── layout/             # Shell, Header, Sidebar, ErrorBoundary
├── features/               # Feature-scoped modules (one per domain)
│   ├── transactions/       # Transaction recording & management
│   ├── vehicles/           # Fuel & service tracking
│   ├── budgets/            # Budget management
│   ├── reports/            # Analysis & dashboards
│   ├── insights/           # Smart recommendations
│   ├── settings/           # User preferences & account management
│   └── reminders/          # Alerts & notifications
├── db/                     # Dexie schema & migrations
├── stores/                 # Zustand state management
├── lib/                    # Pure utility functions
├── hooks/                  # Shared custom hooks (2+ features)
├── types/                  # Shared TypeScript definitions
└── i18n/                   # Internationalization (EN / ES)
```

### Data Flow

1. **User Interaction** → React component event handler
2. **Store Mutation** → Zustand store updates in-memory state
3. **Dexie Persist** → Store writes to IndexedDB (wrapped in try/catch)
4. **UI Rerender** → React reads from Zustand (not Dexie directly)
5. **Error Surface** → Via `sonner` toast notifications

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Zustand over Redux | Lightweight, no boilerplate, perfect for offline PWAs |
| Dexie over raw IndexedDB | Cleaner API, schema versioning, better DX |
| react-hook-form + zod | Type-safe forms with minimal runtime overhead |
| Tailwind + shadcn | Utility-first styling, accessible components, fast iteration |
| Virtual lists | Responsive list rendering even with 1000+ transactions |
| Client-side PDF/CSV | No backend needed, full user privacy |

---

## Feature Architecture

Each feature module (`src/features/<name>/`) is self-contained:

```
features/transactions/
├── components/          # UI components (TransactionForm, List, Card)
├── hooks/              # Feature-specific hooks
├── schemas/            # zod validation schemas
├── types.ts            # TypeScript interfaces (if needed)
└── index.ts            # Barrel export
```

**Rule**: A feature-scoped hook is co-located with its feature. Only when a hook is consumed by 2+ features does it move to `src/hooks/`.

**Rule**: A feature-scoped type file (e.g. `foo.types.ts`) is co-located with its feature. Only when a type is imported by 2+ different features does it move to `src/types/`.

### Store Pattern

All state lives in Zustand stores (`src/stores/<domain>.store.ts`). Each store:
- Loads data from Dexie on `load()`
- Wraps mutations in try/catch → console.error + toast.error()
- Never calls Dexie directly from components
- Exports a single hook (e.g., `useTransactionsStore()`)

### Database Schema

Dexie tables are defined in `src/db/index.ts` with explicit versioning:
- Every structural change adds a new `.version(n)` block
- Never modify existing version blocks
- Migrations happen automatically on version mismatch

---

## Currency & Exchange Rates

- **Currency values** stored as integers (cents) to avoid floating-point errors
- **Exchange rates** stored as numbers (up to 6 decimal places)
- **Base currency** set in settings; all reports convert to this currency
- **API**: Frankfurter v2 (`https://api.frankfurter.dev/v2`) — no key required

### Cross-Currency Transfers

When transferring between accounts with different currencies:
1. TransactionForm detects mismatch
2. CrossCurrencyDialog opens
3. User confirms or fetches live rate from Frankfurter API
4. Transaction stores `exchangeRate` and `originalAmount` (destination-side)

---

## Offline & PWA

- **Vite PWA Plugin** handles service worker generation (Workbox)
- App is installable on mobile (manifest.json + icons)
- Works fully offline; user can update data without connectivity
- Optional manual sync to Google Drive / Dropbox (planned)

---

## Performance Optimizations

| Technique | Where | Benefit |
|-----------|-------|---------|
| Virtual lists | TransactionListPage | Renders 1000+ items smoothly |
| useDeferredValue | DashboardPage, ReportsPage | Keeps navigation instant during memo recomputation |
| Skeleton loaders | Page startup | Better perceived performance |
| Code splitting by route | Router setup | Smaller initial bundle |
| Memoization (useMemo, useCallback) | Custom hooks | Prevents unnecessary re-renders |

---

## Error Handling

- **React Error Boundaries** wrap each feature route
- **Dexie errors** are caught in store mutations → `toast.error()`
- **User-facing errors** always use `sonner` toasts
- Never swallow errors silently

---

## Testing Strategy

- **Vitest** for unit tests
- Focus on pure utility functions (`src/lib/`)
- Regression tests for critical paths (e.g., category renaming)
- Components tested via integration rather than snapshot tests

---

## i18n Strategy

- **English (en)** is the source language
- **Spanish (es)** translations maintain feature parity
- All strings pass through `react-i18next` — no hardcoded English in JSX
- New keys must be added to both `en.json` and `es.json`

---

## Date / Time Handling

### Transaction date storage

Transactions are saved as UTC ISO strings:

```ts
new Date(`${date}T${time}:00`).toISOString()
// e.g. "2026-05-22T05:57:00.000Z"  ← 11:57 PM Chihuahua (UTC-6)
```

### Filter boundary rule — always use LOCAL time, never `Z`

**Common pitfall:** writing `T23:59:59.999Z` for an end-of-day ceiling.

- `T23:59:59.999Z` = 11:59 PM **UTC**.
- A transaction entered at 11:57 PM in Chihuahua (UTC-6) is stored as `T05:57:00.000Z` (next UTC day). That is **after** the `T23:59:59.999Z` ceiling, so it is wrongly excluded.

**Fix:** drop the `Z` suffix to create a **local-time** boundary:

```ts
// ✅ Correct — local end-of-day
new Date(`${dateTo}T23:59:59.999`)          // no Z → interpreted in the device's local timezone
// In UTC-6 this becomes T05:59:59.999Z     → correctly covers all same-day local transactions

// ❌ Wrong — UTC end-of-day
new Date(`${dateTo}T23:59:59.999Z`)         // Z → hard UTC ceiling, excludes late-night local entries
```

Apply the same principle to start-of-day:

```ts
new Date(`${dateFrom}T00:00:00.000`)        // no Z → local midnight
```

### Special case — lexicographic string comparison (BalanceSheetDetailPage)

`BalanceSheetDetailPage` compares `tx.date` (a UTC ISO string) with filter strings **lexicographically**, so both sides must be in the same UTC format:

```ts
const dateFromISO = new Date(`${filters.dateFrom}T00:00:00.000`).toISOString()
const dateToISO   = new Date(`${filters.dateTo}T23:59:59.999`).toISOString()
// Then: tx.date >= dateFromISO && tx.date <= dateToISO
```

Building the `Date` without `Z` first preserves local timezone intent; `.toISOString()` then converts it to the correct UTC string for the comparison.

---

## Security & Privacy

- No analytics, tracking pixels, or telemetry
- No data transmission without explicit user action
- OAuth2 PKCE flow for cloud sync (no client secrets in code)
- Financial data never leaves device unless user triggers export/sync
