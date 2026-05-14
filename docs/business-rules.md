# Business Rules

Core rules that govern behavior across the ExpenseTracking application.

---

## Transaction Management

### Recording & Lifecycle

- **Transaction types**: income, expense, transfer
- **Status flow**: `pending` → `cleared` → `reconciled` (or `cancelled`)
- **Default status**: 
  - `cleared` for manually-entered transactions
  - `pending` for future-dated transactions
- **Amounts stored as**: Integer cents (no floating-point arithmetic)
- **Multi-currency support**: Each transaction records its own currency + exchange rate vs. base currency
- **Labels**: Free-form tags; stored as `string[]` on transaction; linked to a global `labels` table for management

### Transfers Between Accounts

- Always create **two linked records**: debit on source, credit on destination
- Linked by a shared `transferId`
- If currencies differ: user must confirm or fetch exchange rate
- `exchangeRate` stored as the rate FROM source currency TO destination
- `originalAmount` and `originalCurrency` stored on the destination-side transaction

### Reconciliation

- Transaction status can advance from `pending` → `cleared` → `reconciled`
- `reconciled` status indicates user has verified the transaction against a bank statement
- Cannot be reversed to a lower status without explicit edit

---

## Account Management

### Account Types

- `cash` — physical cash wallet
- `bank` — checking/savings account
- `card` — credit/debit card
- `savings` — dedicated savings account
- `investment` — brokerage, crypto, etc.
- `other` — miscellaneous

### Currency & Balances

- Each account has its own `currency` (ISO 4217 code)
- `openingBalance` stored as integer cents in that account's currency
- Account balance = `openingBalance` + sum of all transactions (credits minus debits)
- Accounts can be hidden from reports/totals via `Account.hidden` flag

### Archiving Vehicles

- Vehicles can be archived (soft delete) to hide from active lists
- Archived vehicles retain all fuel logs and service history (not deleted)
- Can be unarchived later

---

## Budget Management

### Budget Definition

- Each budget applies to a single category
- Spending limits per period: `weekly`, `monthly`, or `yearly`
- Optional rollover: unspent balance carries forward to next period
- Dates: `startDate` (required), `endDate` (optional, open-ended if omitted)

### Budget Consumption

- **Never stored as a derived field** — calculated at read time
- Consumption = sum of all `expense` transactions matching `categoryId` within the period
- Result: `{ spent: number; limit: number; percent: number }`
- Visual indicators:
  - 🟢 Green: < 75%
  - 🟡 Amber: 75–99%
  - 🔴 Red: ≥ 100%

### Alerts

- Alert when budget reaches **80%**
- Alert again when budget reaches **100%** (overspent)
- Alerts only appear if user has enabled notifications

---

## Category Management

### Predefined Categories

The app ships with 15 predefined expense categories:

```
transportation, food-groceries, health, housing, fuel-gas,
restaurants, medical-pharmacy, rent-mortgage, vehicle-maintenance,
supermarket, health-insurance, utilities, entertainment,
education, investments-savings, other
```

### Custom Categories

- Users can create unlimited custom categories
- Custom categories have `isCustom: true` flag
- Cannot delete a category in use by active transactions
- Renaming a category updates the label for all transactions (retroactively)

### Category Icons

- Each category has an associated icon (from lucide-react or custom)
- UI always shows icons with names (no text-only lists)
- Icons support visual recognition for quick scanning

---

## Vehicle & Fuel Tracking

### Vehicle Tracking

- Multiple vehicles per user
- Fields: name, make, model, year (all optional except name)
- Vehicles can be archived without deleting logs

### Fuel Logging

- Log entry fields: date, liters, totalCost, odometer reading
- **Auto-calculated metrics**:
  - `kmPerLiter` = distance since last fill / liters
  - `costPerKm` = totalCost / distance since last fill
  - `kmSinceLastFill` = current odometer - previous odometer
- Cost stored in the transaction's account currency (linked via `linkedTx`)

### Service Tracking

- Log entry fields: date, serviceType, cost, odometer, notes
- Optional service alerts: `nextServiceKm`, `nextServiceDate`
- Cost linked to a transaction (optional)

### Fuel Efficiency Alerts

- Track moving average over last N fill-ups
- Alert if efficiency degrades > 10% vs. recent average

---

## Currency & Exchange Rates

### Base Currency

- Single base currency per user (set in settings)
- All reports and dashboards display totals in base currency
- Each account maintains its own currency; balances converted at read time

### Exchange Rates

- Fetched from **Frankfurter API v2** (`https://api.frankfurter.dev/v2`)
- Cached in local `exchangeRates` Dexie table
- Manual rate entry also supported (user-supplied rates)
- Historical rates retained for reporting and analysis

### Rate Freshness

- User manually triggers "Fetch rates" from Settings
- Most recent rate is used for conversions (updated daily by default)
- Rates are never auto-fetched; user controls sync timing

---

## Reporting & Analysis

### Dashboard

- **This month**: Income vs. expenses comparison
- **Budget summary**: Progress on all active budgets (top 3–5 by priority)
- **Quick insights**: Recurring spending patterns, category averages

### Reports Module

- **Pie chart** by category (current month or custom range)
- **Bar chart** monthly trend (3, 6, 12 months)
- **Month-to-month** comparison (same period last year)
- **Cash flow** breakdown by date
- **Filters**: account, category, date range, labels
- **Exports**: CSV, PDF (client-side), JSON

### Insights

- **Recurring patterns**: Group by category + amount (±5% tolerance), check day-of-month regularity
- **Category vs. average**: Flag if current month > 3-month average + 1 std dev
- **Current-month projection**: Daily run-rate extrapolation to EOMonth
- **Fuel efficiency alerts**: Degradation > 10% vs. moving average
- **Savings suggestions**: Based on real user spending data

---

## Data Retention & Archival

### Automatic Deletion

- Transactions older than retention period are **automatically deleted** (configurable; default 7 years)
- Deleted transactions are **not recoverable** except via JSON backup restore
- Fuel logs and service records subject to same retention policy
- See [DATA_RETENTION.md](../DATA_RETENTION.md) for detailed policy

### User-Triggered Deletion

- Users can manually delete individual transactions
- Bulk delete via transaction list (with confirmation)
- No undo after confirmation

### Backup & Recovery

- Full-data JSON export (all 10 tables)
- Optional Google Drive / Dropbox sync
- Users control export frequency and destination

---

## Settings & Preferences

### User Settings

Stored in `settings` table as key-value pairs:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `baseCurrency` | string (ISO 4217) | USD | Currency for all reports |
| `language` | string | en | UI language (en or es) |
| `theme` | string | system | UI theme (light, dark, system) |
| `googleClientId` | string | — | OAuth2 client ID for Google Drive sync |
| `aiApiKey` | string | — | Optional API key for AI insights (Tier 2) |
| `retentionDays` | number | 2555 (7 years) | Days to retain transactions before auto-delete |

### Preference Persistence

- All settings persisted to `settings` Dexie table
- Applied on app startup via `useSettingsStore`
- Changes reflected immediately in UI (no page reload required)

---

## Internationalization

### Supported Languages

- **English (en)** — source language; complete and always up-to-date
- **Spanish (es)** — maintained for feature parity with English

### Translation Rules

1. All user-facing strings must pass through `react-i18next`
2. No hardcoded English strings in JSX
3. New keys added to **both** `en.json` **and** `es.json` simultaneously
4. Fallback to English if Spanish key missing (handled gracefully)

### Locale Selection

- User can toggle language in Settings
- Preference persisted to `settings` table
- Applied via `i18n.changeLanguage(language)` on app boot

---

## Security & Privacy

### Data Handling

- All financial data stored **locally only** (IndexedDB)
- No data transmission without explicit user action
- No analytics, tracking pixels, or telemetry

### Cloud Sync (When Implemented)

- **OAuth2 PKCE flow** (no client secrets in code)
- User controls when sync occurs (no auto-sync)
- Data stored in user's own cloud account (Google Drive / Dropbox)
- Encrypted at rest (cloud provider's responsibility)

### Export & Backup

- JSON export is user's responsibility for local backup
- PDF/CSV exports contain only filtered data (user's selection)
- Exports never auto-upload anywhere

---

## Performance & Constraints

### Load Times

- App boots to interactive state within **2 seconds** on 4G mobile
- Dashboard renders within **1 second** on 1000+ transactions

### Transaction Limit

- No hard limit; tested up to **10,000 transactions** without performance degradation
- Virtual lists handle rendering efficiently

### Network Usage

- Zero network traffic in offline mode
- Exchange rate fetch: ~10 KB (on-demand, user-triggered)
- No background sync (user-triggered only)

---

## Quality Gates

### Linting

- ESLint blocks unused imports (`@typescript-eslint/no-unused-vars: error`)
- Pre-commit hook enforces zero lint warnings
- Auto-fix available via `npm run lint:fix`

### Testing

- Unit tests focus on pure utility functions
- Regression tests for critical paths (category renaming, budget calculations)
- Run via `npm run test` or `npm run test:watch`

### Type Safety

- TypeScript strict mode always enabled
- Zero `any` types allowed
- Must pass `npx tsc --noEmit` before commit

---

## User Experience Principles

1. **Speed**: Transaction recorded in ≤ 3 taps
2. **Accessibility**: WCAG 2.1 AA compliance target
3. **Mobile-first**: Responsive design for 360px+ screens
4. **Icons over text**: Category selection uses visual recognition
5. **Offline-first**: Works without internet; data syncs when available
6. **Clear feedback**: Toast notifications for all actions (success, error, warning)
