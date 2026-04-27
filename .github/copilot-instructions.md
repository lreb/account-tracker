# ExpenseTracking — Copilot Workspace Instructions

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

## Data Architecture

Data is persisted in **Dexie.js (IndexedDB)**. Zustand holds in-memory state and syncs to Dexie on mutations.

### Core Tables / Stores

```ts
// transactions — income, expense, and transfer records
{
  id: string;                // uuid
  type: 'income' | 'expense' | 'transfer';
  amount: number;            // in account's currency (integer cents)
  date: string;              // ISO 8601
  categoryId: string;
  accountId: string;         // source account
  toAccountId?: string;      // destination account (transfers only)
  description: string;
  notes?: string;
  status: 'pending' | 'cleared' | 'reconciled' | 'cancelled';
  labels?: string[];         // user-defined tags (e.g. ['business', 'tax-deductible'])
  currency: string;          // ISO 4217 (e.g. 'USD', 'MXN', 'EUR')
  exchangeRate?: number;     // rate vs. baseCurrency at time of transaction (cross-currency only)
  originalAmount?: number;   // amount in source currency before conversion (cross-currency transfers)
  originalCurrency?: string; // source currency code (cross-currency transfers)
}

// accounts — cash, bank, card, savings, etc.
{
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'savings' | 'investment' | 'other';
  openingBalance: number;    // integer cents, in account's own currency
  currency: string;          // ISO 4217 — each account can have its own currency
}

// categories — predefined + user-created
{
  id: string;
  name: string;
  icon: string;          // icon name/key
  isCustom: boolean;
}

// labels — user-defined tags for transactions
{
  id: string;
  name: string;
  color?: string;        // hex color for UI badge
}

// exchangeRates — historical rates for reporting (user-entered or fetched manually)
{
  id: string;
  fromCurrency: string;  // ISO 4217
  toCurrency: string;    // ISO 4217
  rate: number;
  date: string;          // ISO 8601 — rate on that specific date
}

// settings — key-value store for user preferences
{
  key: string;           // e.g. 'baseCurrency', 'language', 'theme'
  value: string;
  // baseCurrency: ISO 4217 code — all reports and totals are converted to this currency
}

// budgets — spending limits per category and period
{
  id: string;
  categoryId: string;        // which category this budget applies to
  amount: number;            // limit in baseCurrency cents
  period: 'weekly' | 'monthly' | 'yearly';
  rollover: boolean;         // whether unspent amount carries over to next period
  startDate: string;         // ISO 8601 — when this budget takes effect
  endDate?: string;          // ISO 8601 — optional end date (open-ended if omitted)
  currency: string;          // ISO 4217 — must match baseCurrency for consistent reporting
}

// vehicles
{
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

// fuelLogs
{
  id: string;
  vehicleId: string;
  date: string;
  liters: number;
  totalCost: number;
  odometer: number;
  // calculated: costPerLiter, kmSinceLastFill, kmPerLiter
}

// vehicleServices
{
  id: string;
  vehicleId: string;
  date: string;
  serviceType: string;
  cost: number;
  odometer: number;
  notes?: string;
  nextServiceKm?: number;
  nextServiceDate?: string;
}
```

---

## Application Modules

### 1. Transaction Recording (`/transactions`)
- Add/edit/delete income, expenses, and **account-to-account transfers**
- Transfer entry: source account, destination account, amount, exchange rate (if different currencies)
- Fields: amount, date, category, account, description, notes, status, labels, currency
- Transaction status lifecycle: `pending → cleared → reconciled` (or `cancelled`)
- Label / tag support: multiple free-form labels per transaction
- Multi-currency: each transaction records its own currency + exchange rate vs. base currency
- Quick category picker with icons (max 3 taps to record)

### 2. Vehicle & Fuel Management (`/vehicles`)
- Register multiple vehicles
- Log refuels: liters, total cost, odometer
- Auto-calculate: km/liter, cost/km, km since last fill
- Log services and maintenance
- Alerts for upcoming service (by km or date)

### 3. Reports & Analysis (`/reports`)
- Dashboard: income vs. expenses this month
- Charts: pie (by category), bar (monthly trend)
- Month-to-month and year-to-year comparisons
- Cash flow by period
- Filters: account, category, date range
- Export to PDF (client-side) and CSV

### 4. Budgets (`/budgets`)
- Define spending limits per category (weekly / monthly / yearly)
- Visual progress bar per budget: spent vs. limit
- Color coding: green (< 75%), amber (75–99%), red (≥ 100%)
- Alert when a budget reaches 80% and again at 100%
- Optional rollover: unspent balance carries forward to next period
- Budget summary card on the main dashboard
- Budget vs. actual comparison available in Reports module

### 5. Smart Recommendations (`/insights`)
- Detect recurring spending patterns
- Alert when a category exceeds historical average
- Suggest savings based on real user data
- Project current-month spending

### 6. Settings & Accounts (`/settings`)
- Manage financial accounts (each with its own currency)
- Set **base currency** — all reports and dashboards convert to this currency
- Manage **exchange rates** — manually record or update historical rates
- Manage custom categories and **labels** (name, color)
- Language toggle (en / es)
- Export full data as JSON backup
- Import JSON backup
- Optional Google Drive / Dropbox sync

---

## Predefined Expense Categories

`transportation`, `food-groceries`, `health`, `housing`, `fuel-gas`,
`restaurants`, `medical-pharmacy`, `rent-mortgage`, `vehicle-maintenance`,
`supermarket`, `health-insurance`, `utilities`, `entertainment`,
`education`, `investments-savings`, `other`

---

## UX Principles

- Transaction recorded in **≤ 3 taps/clicks**
- Dashboard is the default landing screen
- All icons for categories use visual recognition (no text-only lists)
- Charts must be readable on small (360px wide) screens
- App works fully **offline**; sync is optional and user-triggered

---

## Security Rules

- Never transmit financial data to external servers without explicit user action
- Google Drive / Dropbox sync uses OAuth2 PKCE flow (no client secrets in code)
- PDF exports may optionally be password-protected
- No analytics, tracking pixels, or telemetry in MVP

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

### Frankfurter Exchange Rate API

The app uses the **Frankfurter v2 API** for live and cached exchange rates. No API key required.

| Endpoint | Description |
|---|---|
| `GET https://api.frankfurter.dev/v2/rates?base={ISO}` | Latest rates for all currencies vs. `base`. Returns `Array<{date,base,quote,rate}>`. |
| `GET https://api.frankfurter.dev/v2/rate/{FROM}/{TO}` | Single-pair rate. Returns `{date,base,quote,rate}`. Used by `CrossCurrencyDialog` for on-demand fetching. |
| `GET https://api.frankfurter.dev/v2/currencies` | All supported currencies with names and symbols. |

**Critical:** the old domain `api.frankfurter.app` now redirects to v1 (legacy). **Always use `api.frankfurter.dev/v2`.**

The store method `fetchFromApi(baseCurrency)` persists all rates for the base currency into the `exchangeRates` Dexie table. The method `fetchSinglePairRate(from, to)` fetches a live rate without persisting — used transiently by `CrossCurrencyDialog`.

### Cross-currency Transfer Flow

When a transfer is created between two accounts whose `currency` fields differ:

1. `TransactionForm` computes `isCrossCurrencyTransfer` from the selected source/destination accounts.
2. An **Exchange Rate** row button is rendered below the destination account selector.
3. Tapping it opens `CrossCurrencyDialog` (`src/features/transactions/components/CrossCurrencyDialog.tsx`).
4. The dialog pre-fills the rate from `getRateForPair(from, to)` (DB cache). If unavailable, the field starts empty.
5. The user can tap **Fetch rate** to call `fetchSinglePairRate` live from the API.
6. On confirm, `setValue('exchangeRate', rate)` is called on the form, and `crossCurrencyDestAmountCents` state is set.
7. On `onSubmit`, `originalAmount` = dest amount in dest currency cents and `originalCurrency` = dest currency are stored on the `Transaction`.



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
