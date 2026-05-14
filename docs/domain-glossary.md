# Domain Glossary

Shared terminology and definitions for the ExpenseTracking domain.

---

## Financial Concepts

### Transaction
A financial event recorded by the user. Can be:
- **Income**: Money received
- **Expense**: Money spent
- **Transfer**: Money moved between accounts

Each transaction has a date, amount, category, account, description, and optional notes and labels.

**Status lifecycle**: `pending` (future-dated) → `cleared` (confirmed) → `reconciled` (verified against bank statement)

---

### Account
A container for money (e.g., checking account, savings account, cash wallet, credit card). Each account has:
- Type: cash, bank, card, savings, investment, other
- Balance: calculated as `openingBalance + sum(transactions)`
- Currency: ISO 4217 code (e.g., USD, EUR, MXN)
- Can be hidden from reports (e.g., closed accounts, linked accounts)

---

### Category
A classification for transactions. Examples: food-groceries, transportation, utilities, entertainment.

**Types**:
- **Predefined**: Shipped with the app; translated to user's language; 15 categories
- **Custom**: User-created; unlimited; not translated

---

### Budget
A spending limit on a category over a period. Key attributes:
- **Period**: weekly, monthly, or yearly
- **Rollover**: unspent amount carries forward to next period (optional)
- **Status**: calculated at read time from actual spending vs. limit
  - 🟢 Green: < 75% spent
  - 🟡 Amber: 75–99% spent
  - 🔴 Red: ≥ 100% spent (overspent)

---

### Transfer
A transaction between two accounts. Special rules:
- Always creates **two linked records**: debit on source, credit on destination
- If currencies differ: requires exchange rate confirmation
- Linked by shared `transferId`

**Example**: Move $100 from Checking (USD) to Savings (USD) = two complementary $100 transactions.

---

### Label (or Tag)
A free-form text label attached to transactions for custom grouping. Examples: "business expense", "tax-deductible", "quarterly review".

Unlike categories (one per transaction), labels are unlimited and user-defined.

---

### Base Currency
The currency in which all reports and dashboards are displayed. Set in Settings.

**Purpose**: In multi-currency scenarios, normalize all account balances and spending totals to a single currency for comparison.

**Example**: If base currency is USD and user has accounts in USD, EUR, and MXN, the dashboard converts all balances to USD.

---

### Exchange Rate
The ratio between two currencies. Stored historically to:
- Record the rate at which a transaction occurred
- Convert cross-currency transfers accurately
- Support historical reporting

**Source**: Frankfurter API (public ECB data) or user-entered manually.

---

### Reconciliation
The process of verifying transactions against a bank statement. A transaction's `status` progresses:
1. `pending` (just entered, future-dated)
2. `cleared` (user confirmed it's real)
3. `reconciled` (matched against bank statement)

---

## Vehicle & Fuel Domain

### Vehicle
A car or motorcycle tracked in the app. Stores:
- Name, make, model, year (all optional except name)
- Soft-deleted via `archived` flag (history retained)

---

### Fuel Log
A refuel event with:
- Date, liters, total cost, odometer reading
- Auto-calculated metrics: cost/liter, km/liter, km since last fill

**Linked Transaction**: Optional reference to an expense transaction recording the cost.

---

### Vehicle Service
A maintenance event (oil change, tire rotation, etc.) with:
- Date, service type, cost, odometer, notes
- Optional projected next service (by km or date)

**Linked Transaction**: Optional reference to an expense transaction.

---

### Fuel Efficiency (km/liter or MPG)
A calculated metric: distance traveled since last fill ÷ liters refueled.

**Alerts**: Warn if efficiency drops > 10% vs. recent moving average (possible mechanical issue).

---

### Cost per Kilometer
Calculated metric: total refuel cost ÷ distance traveled since last fill.

**Use**: Track whether vehicle operating cost is increasing.

---

## Data & Architecture Concepts

### Dexie
An IndexedDB wrapper providing:
- Cleaner API than raw IndexedDB
- Schema versioning (migrations via `.version(n)` blocks)
- Querying (find, filter, sort)
- Transactions with rollback

**In our app**: Persistent layer for all 10 tables (transactions, accounts, budgets, vehicles, etc.).

---

### Zustand
A lightweight state management library. In our app:
- One store per domain (transactions, accounts, budgets, etc.)
- In-memory state that syncs to Dexie on mutations
- Accessed via hooks (e.g., `useTransactionsStore()`)

**Rule**: Components read from Zustand, never directly from Dexie.

---

### IndexedDB
A browser API for client-side persistent storage. Provides:
- Larger quota than localStorage (50+ MB on modern browsers)
- Asynchronous API (doesn't block UI)
- Object store paradigm (not SQL)

**Used via**: Dexie.js abstraction (not raw IndexedDB).

---

### Progressive Web App (PWA)
A web app that behaves like a native app:
- Installable on home screen (iOS, Android)
- Works offline via service worker
- Can access device capabilities (camera, location, etc.)

**In our app**: Installable, works fully offline, no app store needed.

---

### Service Worker
A JavaScript worker running in the background, separate from the main thread. Used for:
- Intercepting network requests
- Serving cached assets when offline
- Sync operations (future)

**Generated by**: Vite PWA Plugin (Workbox).

---

### Manifest
A JSON file (`manifest.json`) describing the PWA metadata:
- App name, short name, description
- Icons (multiple sizes for different devices)
- Display mode (e.g., `standalone` for full-screen)
- Theme colors

---

### Offline-First
An architectural pattern where the app assumes offline as the default state and handles online as an enhancement.

**Benefit**: App always works; network unavailability doesn't break core features.

**In our app**: All data stored locally; sync/export is optional and user-triggered.

---

### Local-First
An architectural pattern where data lives on the user's device first, and cloud sync is optional.

**Benefit**: User owns their data; no data transmission without consent.

**In our app**: All financial data in IndexedDB; cloud sync (Dropbox, Google Drive) is opt-in.

---

### Base Conversion
Converting a monetary amount from one currency to another using an exchange rate.

**Formula**: `targetAmount = sourceAmount × exchangeRate`

**Example**: Convert $100 USD to EUR at rate 0.92 = €92.00

**Used for**: Cross-currency transfers, multi-currency reporting.

---

### Aggregation
Summing transactions over a period or category.

**Examples**:
- Total spending by category (pie chart)
- Monthly trend (bar chart)
- Budget consumption (sum of expenses in category)

**Calculated**: At read time from raw transactions (never pre-computed).

---

## User Interaction Concepts

### Quick Transaction Entry
A feature goal: record a transaction in ≤ 3 taps/clicks.

**Typical flow**:
1. Tap "+" button
2. Select category (icon picker)
3. Enter amount, confirm

---

### Recurring Transaction Detection
Identifying transactions that repeat on a predictable schedule.

**Algorithm**: Group by category + amount (±5% tolerance), check day-of-month regularity.

**Use**: Alert user if a recurring expense increases or to project spending.

---

### Category-vs-Average Alert
Notifying user when spending in a category significantly exceeds historical average.

**Trigger**: Current month > 3-month rolling average + 1 standard deviation.

**Example**: "Groceries spending is 25% above your recent average."

---

### Current-Month Spending Projection
Estimating month-end spending based on current run-rate.

**Formula**: `(current spending ÷ days elapsed) × days in month`

**Use**: Show user "on pace to spend $X this month."

---

### Savings Suggestion
Recommending ways to reduce spending based on patterns.

**Examples**:
- "You're spending 15% more on restaurants than last quarter."
- "Groceries have been 20% above budget; consider meal planning."

---

### Virtual List
A React rendering technique displaying only visible items in a scrollable list, improving performance with large datasets.

**In our app**: TransactionListPage uses virtual lists to render 1000+ transactions smoothly.

---

### Skeleton Loader
A placeholder UI (often gray bars) shown while data is loading, improving perceived performance.

**In our app**: Shimmer rows shown during TransactionListPage initial load.

---

## Governance & Process Concepts

### Retention Policy
Rules for how long data is kept before automatic deletion.

**In our app**: Default 7 years (configurable); transactions older than this are auto-deleted.

**Rationale**: Privacy (old data purged automatically), storage optimization, GDPR alignment.

**See**: [DATA_RETENTION.md](../DATA_RETENTION.md)

---

### Decision Log (ADR)
Architecture Decision Records documenting significant choices, rationale, and trade-offs.

**Purpose**: Help contributors understand "why" decisions were made; guide future decisions.

**See**: [decision-log.md](./decision-log.md)

---

### Pre-commit Hook
Automated check run before every `git commit`.

**In our app**: Husky + lint-staged runs ESLint on staged files; commits blocked if errors found.

**Purpose**: Prevent code quality issues from entering the repository.

---

### Code Ownership
Clear assignment of responsibility for a module or feature.

**Pattern**: Feature modules in `src/features/<domain>/` have a single "owner" (e.g., "Transaction feature owner is Frontend Lead").

**Use**: Know who to ask questions about a feature.

---

### i18n (Internationalization)
Supporting multiple languages in the app.

**In our app**: English (source) + Spanish (translation); configurable at runtime.

**Rule**: All strings pass through `react-i18next`; no hardcoded English in JSX.

---

### Accessibility (a11y)
Making the app usable by people with disabilities.

**Target**: WCAG 2.1 AA compliance.

**Examples**: Keyboard navigation, screen reader support, sufficient color contrast, meaningful link text.

---

### Type Safety
Using TypeScript's static type system to catch errors at compile time.

**In our app**: Strict mode; zero `any` types; required before commit.

**Benefit**: Fewer runtime errors, better IDE support, clearer code intent.

---

## Testing Concepts

### Unit Test
Testing a single function or component in isolation.

**In our app**: Vitest for utility functions in `src/lib/` (e.g., budget calculation, currency conversion).

---

### Integration Test
Testing how multiple components work together.

**In our app**: Form submission flow (form → validation → store → Dexie).

---

### Regression Test
Testing that a bug fix or feature change doesn't break existing behavior.

**Example**: After renaming a category, ensure all transactions retroactively show the new name (not the old one).

---

### Snapshot Test
Capturing the rendered output of a component and comparing to baseline in future runs.

**In our app**: Not used (prefer integration tests; snapshots brittle for UI).

---

## External Services

### Frankfurter API
A public exchange rate API providing historical and current currency conversion rates.

**Base URL**: `https://api.frankfurter.dev/v2`

**No API key required**; ECB-backed data.

**Used for**: Fetching live rates for cross-currency transfers and caching for offline use.

---

### Google Drive API
Google's cloud storage API, used for optional cloud backup/sync.

**Auth**: OAuth2 PKCE flow (no client secrets).

**Used for**: Backing up and restoring app data (planned v1.1+).

---

### Dropbox API
Dropbox's cloud storage API, used for optional cloud backup/sync.

**Auth**: OAuth2 PKCE flow (no client secrets).

**Used for**: Alternative to Google Drive for cloud sync (planned v1.1+).

---

### OpenAI API
Optional service for AI-powered financial insights (Tier 2, v1.2).

**Usage**: User supplies API key; insights sent as aggregated summary (never raw transaction data).

**Auth**: API key stored locally in settings.

---

## Abbreviations & Acronyms

| Acronym | Expansion | Usage |
|---------|-----------|-------|
| PWA | Progressive Web App | The app architecture |
| SPA | Single Page App | React frontend |
| ISO 4217 | ISO standard for currency codes | e.g., USD, EUR, MXN |
| CSV | Comma-Separated Values | Export format for transactions |
| JSON | JavaScript Object Notation | Backup format, API responses |
| PDF | Portable Document Format | Report export format (client-side) |
| API | Application Programming Interface | External services (Frankfurter, Google Drive) |
| OAuth2 | Open standard for authorization | Cloud sync auth flow |
| PKCE | Proof Key for Code Exchange | Secure OAuth2 variant (no client secrets) |
| UI | User Interface | Visual elements |
| UX | User Experience | How users interact with the app |
| CRUD | Create, Read, Update, Delete | Basic data operations |
| ORM | Object-Relational Mapping | Dexie (abstraction over IndexedDB) |
| DOM | Document Object Model | Browser's in-memory representation of HTML |
| HMR | Hot Module Replacement | Vite's fast refresh feature |
| ESLint | Error & Style Linter | Code quality tool |
| Vitest | Vite + Jest-compatible testing | Test runner |
| GDPR | General Data Protection Regulation | EU privacy law; influences retention policy |
| CCPA | California Consumer Privacy Act | US privacy law |
| WCAG | Web Content Accessibility Guidelines | Accessibility standard |
| ADR | Architecture Decision Record | Documented design decision |
| MVP | Minimum Viable Product | v1.0 release |
| a11y | Accessibility (numeronym) | Making app usable by all |
| i18n | Internationalization (numeronym) | Multi-language support |
| l10n | Localization (numeronym) | Language-specific adaptation |

---

## See Also

- [architecture.md](./architecture.md) — System design and layers
- [business-rules.md](./business-rules.md) — Core rules governing behavior
- [api-contracts.md](./api-contracts.md) — Data model schemas and external APIs
- [decision-log.md](./decision-log.md) — Architectural decisions (ADRs)
- [../copilot-instructions.md](../copilot-instructions.md) — Project conventions and patterns
