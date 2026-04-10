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
│   ├── vehicles.store.ts
│   └── settings.store.ts
├── lib/
│   ├── currency.ts          # convertToBase(), formatCurrency()
│   ├── budgets.ts           # getBudgetUsage()
│   ├── vehicles.ts          # calcKmPerLiter(), calcCostPerKm()
│   └── dates.ts             # getPeriodRange(), helpers wrapping date-fns
├── hooks/                   # Shared custom hooks (useSettings, useToast, etc.)
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

### Linting
- ESLint is configured in `eslint.config.js` (flat config, ESLint 9+) with `@typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`
- `@typescript-eslint/no-unused-vars: error` — **unused imports are a lint error and will block commits**
- `react-refresh/only-export-components: warning (treated as error)` — a `.tsx` file must export **only React components**. If a component file also needs to export types, interfaces, or constants that other files consume, move those exports into a companion `<name>.types.ts` file (e.g. `balance-sheet-detail-filters.types.ts`) and import from there in both the component and its consumers.
- `npm run lint` — checks all of `src/` with zero warnings allowed
- `npm run lint:fix` — auto-fixes what ESLint can
- A **Husky pre-commit hook** runs `lint-staged` before every `git commit`; only staged `src/**/*.{ts,tsx}` files are linted, so commits are blocked if any staged file has a lint error

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
| 1 | Insights | `InsightsPage` is a stub ("coming soon"). Implement: recurring-pattern detection, category-vs-average alerts, savings suggestions, current-month projection. | ❌ Not started |
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
