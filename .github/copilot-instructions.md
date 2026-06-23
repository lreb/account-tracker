# ExpenseTracking — Copilot Workspace Instructions

---

## 📚 Documentation Hub

**This document is a quick reference.** For detailed information, see:

| Topic | Location | Coverage |
|-------|----------|----------|
| **Architecture & design decisions** | [docs/architecture.md](../docs/architecture.md) | System layers, module organization, design patterns, performance optimizations |
| **Data models & API contracts** | [docs/api-contracts.md](../docs/api-contracts.md) | TypeScript interfaces, Frankfurter API, store hooks, backup formats |
| **Core business rules** | [docs/business-rules.md](../docs/business-rules.md) | Transaction lifecycle, budgets, categories, currency handling, reconciliation, retention policy |
| **Architectural decisions (ADRs)** | [docs/decision-log.md](../docs/decision-log.md) | Why we chose Zustand, Dexie, React 19 + Vite, offline-first, etc. (18 decisions documented) |
| **Domain terminology** | [docs/domain-glossary.md](../docs/domain-glossary.md) | Shared vocabulary, financial concepts, tech terms, abbreviations |
| **PWA intranet testing** | [docs/PWA-INTRANET-MANUAL.md](../docs/PWA-INTRANET-MANUAL.md) | Manual & automated LAN publish, Android testing, firewall notes |

---

## Role & Expertise

You are a **senior frontend engineer** with deep expertise in React and TypeScript, specializing in Progressive Web Apps (PWAs). You have extensive experience building performant, offline-capable, production-grade frontend applications with no backend dependency.

## How You Work

- Write **production-ready code**, not illustrative snippets
- Explain architectural decisions when they matter — briefly and clearly
- Flag trade-offs when multiple approaches exist
- Proactively point out potential issues: performance, offline edge cases, data integrity, browser compatibility
- Follow modern React patterns: functional components, hooks, composition over inheritance
- When asked to analyze or review, be direct and specific — no vague feedback
- Never add features, refactoring, or "improvements" beyond what was explicitly asked

## Goals & Priorities

- Clean, maintainable, strongly typed TypeScript (strict mode always)
- Offline-first — every feature must work without an internet connection
- Responsive UI suitable for mobile (360px+) and desktop
- Efficient local data management via Dexie.js (IndexedDB)
- Minimal bundle size and fast load performance
- Accessibility and usability best practices

---

## Project Overview

**ExpenseTracking** is a personal finance PWA + Android application. Users record income and expenses, track vehicle fuel and maintenance, and view reports. There is **no backend and no database service** — all data lives on the user's device.

- **Type**: Progressive Web App (PWA) + Android (via Capacitor)
- **Architecture**: Local-first, offline-first, zero backend in MVP
- **Language**: TypeScript (strict mode)
- **Target**: Mobile-first UI, also usable on desktop browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Routing | react-router-dom v7 |
| State management | Zustand |
| Local database | Dexie.js (IndexedDB wrapper) |
| Forms | react-hook-form |
| Validation | zod |
| Toast / Notifications | sonner |
| Charts | Recharts |
| PDF generation | @react-pdf/renderer (client-side only) |
| PWA / Offline | Vite PWA Plugin (Workbox) |
| Android packaging | Capacitor.js |
| Cloud export | Google Drive API (OAuth2 PKCE), Dropbox SDK |
| i18n | react-i18next (English first, Spanish later) |

**Constraints:**
- Open source libraries only
- No backend, no server, no database service (PostgreSQL, Firebase, Supabase, etc.)
- No data leaves the device unless the user explicitly triggers an export/sync
- All PDF and CSV generation must happen client-side

---

## Routing

All routes are defined in `src/app/router.tsx` using `createBrowserRouter` from react-router-dom v7.

```
/                        → Dashboard (default landing screen)
/transactions            → Transaction list
/transactions/new        → New transaction form
/transactions/:id        → Edit transaction
/vehicles                → Vehicle list
/vehicles/:id            → Vehicle detail (fuel logs + service history)
/reports                 → Reports & analysis
/budgets                 → Budget list and management
/insights                → Smart recommendations
/settings                → Settings & accounts
/settings/accounts       → Account management
/settings/categories     → Category management
/settings/labels         → Label management
/settings/exchange-rates → Exchange rate management
```

---

## Project Structure

```
src/
├── app/
│   ├── App.tsx              # Root component, providers
│   └── router.tsx           # createBrowserRouter route definitions
├── components/
│   ├── ui/                  # shadcn/ui primitives + custom reusable UI components (AccountSelect, StatusSelect, ScrollToTopButton, AmountCalculatorButton, LabelPickerButton, etc.)
│   └── layout/              # Shell, sidebar, header, page wrapper
├── features/
│   ├── transactions/
│   │   ├── components/      # TransactionForm, TransactionList, TransactionCard
│   │   ├── hooks/           # useTransactions, useTransactionForm
│   │   └── schemas/         # zod schemas for transaction forms
│   ├── vehicles/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── schemas/
│   ├── reports/
│   │   └── components/      # Charts, export buttons, filter panels
│   ├── budgets/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── schemas/
│   ├── insights/
│   │   └── components/
│   └── settings/
│       ├── components/
│       └── schemas/
├── db/
│   └── index.ts             # Dexie singleton — all table definitions and migrations
├── stores/
│   ├── transactions.store.ts
│   ├── accounts.store.ts
│   ├── budgets.store.ts
│   ├── categories.store.ts
│   ├── labels.store.ts
│   ├── exchange-rates.store.ts
│   ├── vehicles.store.ts
│   └── settings.store.ts
├── lib/
│   ├── currency.ts          # convertToBase(), formatCurrency()
│   ├── budgets.ts           # getBudgetUsage()
│   ├── vehicles.ts          # calcKmPerLiter(), calcCostPerKm()
│   └── dates.ts             # getPeriodRange(), helpers wrapping date-fns
├── hooks/                   # Shared custom hooks (used by 2+ features; currently empty — see Hooks Reference)
├── types/                   # Shared TypeScript interfaces and enums
└── i18n/
    ├── index.ts             # i18next init
    ├── en.json
    └── es.json
```

---

### Data Persistence

Data is persisted in **Dexie.js (IndexedDB)**. Zustand holds in-memory state and syncs to Dexie on mutations.

**For detailed data models:** See [docs/api-contracts.md](../docs/api-contracts.md)  
**For business rules on transactions, budgets, categories:** See [docs/business-rules.md](../docs/business-rules.md)  
**For table definitions and schema versioning:** See [src/db/index.ts](../src/db/index.ts)

---

### Application Modules

The app is organized around these feature domains:

- **Transactions** (`/transactions`) — Record income, expenses, transfers with status tracking
- **Vehicles** (`/vehicles`) — Fuel logging, service tracking, efficiency metrics
- **Reports** (`/reports`) — Dashboards, charts, filters, CSV/PDF exports
- **Budgets** (`/budgets`) — Spending limits, progress tracking, alerts
- **Insights** (`/insights`) — Recurring patterns, category alerts, spending projections
- **Settings** (`/settings`) — Accounts, categories, labels, exchange rates, language, backups

**For complete module descriptions:** See [docs/business-rules.md](../docs/business-rules.md#application-modules)

---

## Hooks Reference

> **Rule for AI agents**: Before adding a new hook, check this section. Prefer extending an existing hook over creating a new one. A hook must be co-located with its feature unless it is consumed by two or more features — then it moves to `src/hooks/`.

### Feature Hooks (`src/features/<module>/hooks/`)

| Hook | File | Signature | Purpose |
|---|---|---|---|
| `useGroupedTransactions` | `src/features/transactions/hooks/useGroupedTransactions.ts` | `(transactions: Transaction[]) => FlatTransactionItem[]` | Groups a `Transaction[]` (pre-sorted newest-first) by **local** calendar date into a flat array of `{ kind: 'header' }` and `{ kind: 'tx' }` items ready for plain or virtual-list rendering. Uses `format(new Date(tx.date), 'yyyy-MM-dd')` to bucket by local date (prevents UTC midnight crossings from landing in the wrong day group). Shared by `TransactionListPage` and `BalanceSheetDetailPage`. |

**`FlatTransactionItem` type** (exported from the same file):
```ts
type FlatTransactionItem =
  | { kind: 'header'; dateKey: string; headerLabel: string; count: number }
  | { kind: 'tx'; tx: Transaction; timeStr: string }
```

### Store Hooks (`src/stores/`)

Each Zustand store is a hook. All mutations write through to Dexie and surface errors via `toast.error()`. Never call Dexie directly from a component — go through the store.

| Hook | File | State & Methods |
|---|---|---|
| `useTransactionsStore()` | `transactions.store.ts` | `transactions: Transaction[]`, `loading: boolean`, `load(since?: string)`, `add(t)`, `update(t)`, `remove(id)`, `removeMany(ids)` — `load` accepts an optional ISO lower-bound to load only a date-range slice from Dexie |
| `useAccountsStore()` | `accounts.store.ts` | `accounts: Account[]`, `load()`, `add(a)`, `update(a)`, `remove(id)` |
| `useCategoriesStore()` | `categories.store.ts` | `categories: Category[]`, `load()`, `add(c)`, `update(c)`, `remove(id)` |
| `useLabelsStore()` | `labels.store.ts` | `labels: Label[]`, `load()`, `add(l)`, `update(l)`, `remove(id)` |
| `useBudgetsStore()` | `budgets.store.ts` | `budgets: Budget[]`, `load()`, `add(b)`, `update(b)`, `remove(id)` |
| `useExchangeRatesStore()` | `exchange-rates.store.ts` | `rates: ExchangeRate[]`, `isFetching: boolean`, `load()`, `fetchFromApi(baseCurrency)`, `addManual(rate)`, `remove(id)`, `getRateForPair(from, to): number \| null` |
| `useSettingsStore()` | `settings.store.ts` | `baseCurrency: string`, `language: string`, `theme: AppTheme`, `googleClientId: string`, `load()`, `saveSetting(key, value)` |
| `useVehiclesStore()` | `vehicles.store.ts` | `vehicles`, `fuelLogs`, `vehicleServices`, `load()`, `addVehicle(v)`, `updateVehicle(v)`, `archiveVehicle(id)`, `unarchiveVehicle(id)`, `removeVehicle(id)`, `addFuelLog(f)`, `updateFuelLog(log, linkedTx?)`, `removeFuelLog(id)`, `addService(s)`, `updateService(svc, linkedTx?)`, `removeService(id)` |

### Third-Party Hooks Used Directly in Components

| Hook | Package | Notes |
|---|---|---|
| `useTranslation()` | `react-i18next` | All user-facing strings must go through `t()` — no hardcoded English in JSX |
| `useParams()` | `react-router-dom` | Route path params (e.g. `accountId`, `vehicleId`) |
| `useSearchParams()` | `react-router-dom` | URL query-string state (period presets, filter state that should survive back-navigation) |
| `useNavigate()` | `react-router-dom` | Programmatic navigation |
| `useForm()` | `react-hook-form` | Always with `zodResolver` — never raw `useState` for form state |
| `useVirtualizer()` | `@tanstack/react-virtual` | Virtual list in `TransactionListPage`; `estimateSize` tuned per row kind (`header` ≈ 40 px, `tx` ≈ 88 px) |

### Conventions for New Hooks

- Feature-scoped hook (one feature only) → `src/features/<module>/hooks/<hookName>.ts`
- Shared hook (two or more features) → `src/hooks/<hookName>.ts`
- A hook file must export **only the hook** (and its return/param types) — no React components — to satisfy `react-refresh/only-export-components`. If the hook's types are consumed elsewhere, move them to a companion `<hookName>.types.ts` file.
- Hooks that call Dexie directly must wrap in `try/catch` → `console.error` + `toast.error()`
- All `useMemo` / `useCallback` deps must be listed explicitly — no lint-suppression comments

---

## Code Conventions

- All components in `src/components/`, feature modules in `src/features/<module>/`
- Dexie database instance is a singleton exported from `src/db/index.ts`
- Zustand stores live in `src/stores/<domain>.store.ts`
- Keep all calculations (km/liter, cost/km, summaries, currency conversion) in pure utility functions under `src/lib/`
- Use `date-fns` for all date manipulation
- Currency values stored as **integers (cents)** to avoid floating-point errors
- Exchange rates stored as `number` with up to 6 decimal places
- Cross-currency conversion: `convertToBase(amountCents, exchangeRate)` → always returns base-currency cents
- Transfer transactions always create **two linked records**: debit on source account, credit on destination account — linked by a shared `transferId`
- `status` defaults to `'cleared'` for manual entries; `'pending'` for future-dated transactions
- Budget consumption is calculated at read time by summing `expense` transactions matching `categoryId` within the budget's `period` — never stored as a derived field
- `getBudgetUsage(budgetId): { spent: number; limit: number; percent: number }` lives in `src/lib/budgets.ts`
- Labels are stored as `string[]` on the transaction; the `labels` table is used only for managing available label definitions
- All user-facing strings must go through `react-i18next` — no hardcoded English strings in JSX

### Version Management

The application version is automatically read from `package.json` at build time and displayed in the Sidebar.

**To update the version:**
1. Edit the `version` field in `package.json` (e.g., `"version": "1.0.6"`)
2. The version is automatically exposed globally as `__APP_VERSION__` via Vite's `define` option in `vite.config.ts`
3. The Sidebar component (`src/components/layout/Sidebar.tsx`) displays it below the app name

**No other files need to be updated** — the version is the single source of truth in `package.json`.

### Exchange Rates & Multi-Currency

The app uses **Frankfurter v2 API** (`https://api.frankfurter.dev/v2`) for exchange rates (no API key required).

**For detailed API endpoints and cross-currency transfer flow:** See [docs/api-contracts.md#frankfurter-exchange-rate-api](../docs/api-contracts.md#frankfurter-exchange-rate-api) and [docs/business-rules.md#exchange-rates--multi-currency](../docs/business-rules.md#exchange-rates--multi-currency)

**Important:** Always use `api.frankfurter.dev/v2` (not deprecated `api.frankfurter.app`)

### Linting
- ESLint is configured in `eslint.config.js` (flat config, ESLint 9+) with `@typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`
- `@typescript-eslint/no-unused-vars: error` — **unused imports are a lint error and will block commits**
- `react-refresh/only-export-components: warning (treated as error)` — a `.tsx` file must export **only React components**. If a component file also needs to export types, interfaces, or constants that other files consume, move those exports into a companion `<name>.types.ts` file (e.g. `balance-sheet-detail-filters.types.ts`) and import from there in both the component and its consumers.
- `npm run lint` — checks all of `src/` with zero warnings allowed
- `npm run lint:fix` — auto-fixes what ESLint can
- `npm run test` — runs unit tests once via Vitest
- `npm run test:watch` — runs unit tests in watch mode during local development
- A **Husky pre-commit hook** runs `lint-staged` before every `git commit`; only staged `src/**/*.{ts,tsx}` files are linted, so commits are blocked if any staged file has a lint error

### Testing
- Unit tests use **Vitest**
- To run one file: `npm run test -- src/lib/categories.test.ts`
- Keep regression tests when fixing bugs; for category naming behavior, maintain coverage in `src/lib/categories.test.ts` for custom categories, translated defaults, renamed defaults, and missing translation fallback

### Form Handling
- All forms use `react-hook-form` with a `zod` schema via `zodResolver`
- Each feature's zod schemas live in `src/features/<module>/schemas/`
- Never use uncontrolled inputs or raw `useState` for form state

### Error Handling
- All user-facing errors and success messages use `sonner` toasts: `toast.success()`, `toast.error()`
- Dexie errors must be caught in the store mutation and surfaced via `toast.error()`
- React Error Boundaries wrap each feature route for unexpected render errors
- Never swallow errors silently — always at minimum `console.error` + toast in production code

### Dexie Schema Versioning
- The Dexie database is defined in `src/db/index.ts` with explicit version numbers
- Every change to table structure (add/remove table, add/remove indexed field) requires a **new `.version(n)` block** — never modify an existing version block
- The current version number must be a comment at the top of `src/db/index.ts`
- Example pattern:
  ```ts
  // Current DB version: 2
  const db = new Dexie('ExpenseTracking');
  db.version(1).stores({ transactions: '++id, date, accountId' });
  db.version(2).stores({ transactions: '++id, date, accountId, categoryId', budgets: '++id, categoryId' });
  ```

---

## Release Tracker

> Last audited: 2026-03-13. Update the status column as items are completed.

### v1.0 — Blockers (must ship)

| # | Area | Item | Status |
|---|---|---|---|
| 1 | Insights | `InsightsPage` is a stub ("coming soon"). Implement: recurring-pattern detection, category-vs-average alerts, savings suggestions, current-month projection. | ✅ Done |
| 2 | Settings | JSON full-data **export** (all tables → single `.json` file download). | ✅ Done |
| 3 | Settings | JSON full-data **import / restore** (parse backup file, wipe DB, bulk-insert all tables). | ✅ Done |
| 4 | Error handling | `ErrorBoundary` React component wrapping each feature route in `router.tsx` — prevents a single-page crash from white-screening the whole app. | ✅ Done |
| 5 | PWA / Offline | Install `vite-plugin-pwa`, configure Workbox, add `manifest.json` (name, icons, theme color, display: standalone). App must work fully offline and be installable on mobile. | ✅ Done |

### v1.1 — Planned (post-launch)

| # | Area | Item | Notes |
|---|---|---|---|
| 6 | Reports | PDF export of report/transaction data (`@react-pdf/renderer`, client-side only). | Dep not installed; CSV export covers the need for v1 |
| 7 | Android | Capacitor packaging for Google Play distribution. | PWA install covers mobile for v1 |
| 8 | Cloud sync | Google Drive sync (OAuth2 PKCE flow, no client secrets). | ✅ Done |
| 9 | Cloud sync | Dropbox sync (OAuth2 PKCE flow). | Same as above |
| 10 | i18n | Spanish (`es`) translation completeness pass — verify all new keys added after initial build are present in `es.json`. | ✅ Done |

### v1.2 — AI / Smart Insights

> Strategy: Tier 1 (offline statistical logic) ships in v1.0 as part of InsightsPage. Tier 2 (user-supplied API key) ships as an opt-in feature in v1.2. Tier 3 (on-device LLM) is deferred indefinitely due to PWA bundle-size constraints.

#### Tier 1 — Offline statistical engine (`src/lib/insights.ts`) — ships in v1.0 InsightsPage

| # | Feature | Technique | Status |
|---|---|---|---|
| T1-1 | Recurring transaction detection | Group by `categoryId` + amount tolerance (±5%), check day-of-month regularity | ✅ Done |
| T1-2 | Category-vs-average alert | Rolling 3-month average per category; flag if current month > avg + 1 std dev | ✅ Done |
| T1-3 | Current-month spending projection | Current-month daily run-rate extrapolation | ✅ Done |
| T1-5 | Fuel efficiency trend alert | Moving average over last N fill-ups; flag degradation > 10% | ✅ Done |

#### Tier 2 — Opt-in cloud AI analysis (user-supplied API key) — v1.2

| # | Feature | Implementation notes | Status |
|---|---|---|---|
| T2-1 | AI API key setting | Add `aiApiKey` to `settings` table + `useSettingsStore`; input in Settings UI (same pattern as `googleClientId`) | ❌ Not started |
| T2-2 | Financial summary builder | `buildFinancialSummary()` in `src/lib/ai-insights.ts` — aggregates last 90 days into compact JSON (totals per category, no raw descriptions) | ❌ Not started |
| T2-3 | "Analyze with AI" button | In InsightsPage; disabled when no key set; calls OpenAI `gpt-4o-mini` with summary payload; displays plain-language response | ❌ Not started |
| T2-4 | Security guard | Only aggregated totals sent — never raw transaction descriptions, account names, or amounts | ❌ Not started |
| T2-5 | Budget overrun prediction | (spent so far / days elapsed) × days in month vs budget limit | ❌ Not started |

### Completed (shipped)

| Date | Item |
|---|---|
| 2026-03-13 | `Account.hidden` flag — hide accounts from totals, reports, and selectors app-wide (`src/lib/accounts.ts`) |
| 2026-03-13 | App-startup loading gate — spinner until all Dexie stores resolve, prevents flash of empty state |
| 2026-03-13 | `useDeferredValue(transactions)` in DashboardPage and ReportsPage — keeps navigation instant during heavy memo recomputation |
| 2026-03-13 | Skeleton loader in TransactionListPage — shimmer rows during initial load |
| 2026-03-13 | JSON full backup export — `src/lib/backup.ts` + download trigger in SettingsPage |
| 2026-03-13 | JSON full backup import/restore — confirmation dialog, wipe + bulk-insert all tables |
| 2026-03-13 | Google Drive sync — OAuth2 implicit flow (`src/lib/google-drive.ts`), backup/restore to `appDataFolder`, `VITE_GOOGLE_CLIENT_ID` env var, `/oauth-callback` route, `.env.example` |
| 2026-03-13 | Factory reset (Danger Zone) — wipes all 10 Dexie tables, confirmation dialog, `resetApp()` in `src/lib/backup.ts` |
| 2026-03-13 | Language toggle (EN / ES) — persisted via `settings` table, applied on startup via `i18n.changeLanguage`, UI in SettingsPage |
