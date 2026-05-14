# API Contracts & Data Models

Type definitions and contracts for all core data models and external API interactions.

---

## Core Data Models

### Transaction

```typescript
interface Transaction {
  id: string;                    // UUID
  type: 'income' | 'expense' | 'transfer';
  amount: number;                // Integer cents in transaction's currency
  date: string;                  // ISO 8601 date
  categoryId: string;
  accountId: string;             // Source account
  toAccountId?: string;          // Destination (transfers only)
  description: string;
  notes?: string;
  status: 'pending' | 'cleared' | 'reconciled' | 'cancelled';
  labels?: string[];             // Free-form tags
  currency: string;              // ISO 4217 (e.g., 'USD', 'EUR', 'MXN')
  exchangeRate?: number;         // Rate FROM source → destination (transfers only)
  originalAmount?: number;       // Amount in source currency (cross-currency transfers)
  originalCurrency?: string;     // Source currency code (cross-currency transfers)
  transferId?: string;           // Shared ID linking debit/credit pair
  createdAt?: string;            // ISO 8601 timestamp
  updatedAt?: string;            // ISO 8601 timestamp
}
```

**Validation Schema**: [src/features/transactions/schemas/transaction.schema.ts](../src/features/transactions/schemas/)

---

### Account

```typescript
interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'savings' | 'investment' | 'other';
  openingBalance: number;        // Integer cents in account's currency
  currency: string;              // ISO 4217
  hidden?: boolean;              // Hide from reports/totals
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

**Total Balance Calculation**:
```
balance = openingBalance + Σ(transaction.amount for accountId)
         - Σ(transaction.amount for toAccountId)
```

---

### Category

```typescript
interface Category {
  id: string;
  name: string;
  icon: string;                  // Icon name (lucide-react or custom)
  isCustom: boolean;             // True if user-created
  color?: string;                // Optional hex color for UI
  createdAt?: string;
}
```

**Predefined Categories** (id = lowercase category name):
```
transportation, food-groceries, health, housing, fuel-gas,
restaurants, medical-pharmacy, rent-mortgage, vehicle-maintenance,
supermarket, health-insurance, utilities, entertainment,
education, investments-savings, other
```

---

### Label

```typescript
interface Label {
  id: string;
  name: string;
  color?: string;                // Hex color for badge
  createdAt?: string;
}
```

---

### Budget

```typescript
interface Budget {
  id: string;
  categoryId: string;
  amount: number;                // Integer cents (in baseCurrency)
  period: 'weekly' | 'monthly' | 'yearly';
  rollover: boolean;             // Unspent carries to next period
  startDate: string;             // ISO 8601
  endDate?: string;              // Optional; open-ended if undefined
  currency: string;              // Must match baseCurrency
  createdAt?: string;
  updatedAt?: string;
}
```

**Budget Usage Calculation** (at read time):
```typescript
interface BudgetUsage {
  spent: number;                 // Sum of expenses in category this period (cents)
  limit: number;                 // Budget amount
  percent: number;               // (spent / limit) × 100
  status: 'green' | 'amber' | 'red';  // < 75%, 75–99%, ≥ 100%
}
```

---

### Vehicle

```typescript
interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  archived?: boolean;            // Soft delete
  createdAt?: string;
  updatedAt?: string;
}
```

---

### FuelLog

```typescript
interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;                  // ISO 8601
  liters: number;
  totalCost: number;             // Integer cents
  odometer: number;              // Current mileage reading
  linkedTransactionId?: string;  // Reference to expense transaction
  createdAt?: string;
  updatedAt?: string;
}
```

**Auto-Calculated Metrics** (derived at read time):
```typescript
interface FuelLogMetrics {
  costPerLiter: number;          // totalCost / liters
  kmSinceLastFill: number;       // current.odometer - previous.odometer
  kmPerLiter: number;            // kmSinceLastFill / liters
}
```

---

### VehicleService

```typescript
interface VehicleService {
  id: string;
  vehicleId: string;
  date: string;                  // ISO 8601
  serviceType: string;           // User-defined (e.g., "Oil change", "Tire rotation")
  cost: number;                  // Integer cents
  odometer: number;              // Current mileage at service time
  notes?: string;
  nextServiceKm?: number;        // Projected km for next service
  nextServiceDate?: string;      // Projected date for next service
  linkedTransactionId?: string;  // Reference to expense transaction
  createdAt?: string;
  updatedAt?: string;
}
```

---

### ExchangeRate

```typescript
interface ExchangeRate {
  id: string;
  fromCurrency: string;          // ISO 4217
  toCurrency: string;            // ISO 4217
  rate: number;                  // Up to 6 decimal places
  date: string;                  // ISO 8601 — rate on that specific date
  source: 'frankfurter' | 'manual';  // Origin of rate
  createdAt?: string;
  updatedAt?: string;
}
```

---

### Settings

```typescript
type SettingKey = 
  | 'baseCurrency'               // ISO 4217
  | 'language'                   // 'en' | 'es'
  | 'theme'                      // 'light' | 'dark' | 'system'
  | 'googleClientId'             // OAuth2 client ID
  | 'aiApiKey'                   // Optional API key for AI insights
  | 'retentionDays';             // Days before auto-delete (default 2555 = 7 years)

interface Setting {
  key: SettingKey;
  value: string;                 // All values stored as strings
  createdAt?: string;
  updatedAt?: string;
}
```

---

## External API Contracts

### Frankfurter Exchange Rate API

**Base URL**: `https://api.frankfurter.dev/v2`

#### Get Latest Rates for Base Currency

```http
GET /rates?base={ISO_CODE}
```

**Response**:
```json
[
  {
    "date": "2026-05-12",
    "base": "USD",
    "quote": "EUR",
    "rate": 0.92
  },
  {
    "date": "2026-05-12",
    "base": "USD",
    "quote": "GBP",
    "rate": 0.79
  }
]
```

**Usage**: Bulk fetch all rates for a base currency on demand. Cached in local `exchangeRates` table.

---

#### Get Single Pair Rate

```http
GET /rate/{FROM}/{TO}
```

**Response**:
```json
{
  "date": "2026-05-12",
  "base": "USD",
  "quote": "EUR",
  "rate": 0.92
}
```

**Usage**: Fetch live rate for a specific currency pair (e.g., in CrossCurrencyDialog).

---

#### List Supported Currencies

```http
GET /currencies
```

**Response**:
```json
{
  "AED": {
    "name": "UAE Dirham",
    "symbol": "د.إ"
  },
  "USD": {
    "name": "US Dollar",
    "symbol": "$"
  },
  "EUR": {
    "name": "Euro",
    "symbol": "€"
  }
}
```

**Usage**: Populate currency picker dropdowns.

---

### Google Drive API (Planned)

**Auth Flow**: OAuth2 PKCE (no client secrets)

```typescript
interface GoogleDriveSync {
  // Save backup to user's Google Drive app data folder
  saveBackup(data: BackupData): Promise<void>;
  
  // Restore backup from Google Drive
  restoreBackup(): Promise<BackupData>;
  
  // List all backups
  listBackups(): Promise<DriveFile[]>;
}
```

**See**: [src/lib/google-drive.ts](../src/lib/google-drive.ts)

---

### Dropbox API (Planned)

**Auth Flow**: OAuth2 PKCE (no client secrets)

```typescript
interface DropboxSync {
  saveBackup(data: BackupData): Promise<void>;
  restoreBackup(): Promise<BackupData>;
  listBackups(): Promise<DropboxFile[]>;
}
```

---

## Backup & Export Formats

### JSON Full Backup

```typescript
interface BackupData {
  version: string;               // Semantic version (e.g., "1.0.0")
  exportDate: string;            // ISO 8601 timestamp
  tables: {
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    budgets: Budget[];
    vehicles: Vehicle[];
    fuelLogs: FuelLog[];
    vehicleServices: VehicleService[];
    labels: Label[];
    exchangeRates: ExchangeRate[];
    settings: Setting[];
  };
}
```

**File name convention**: `expense-tracking-backup-{YYYYMMDD}.json`

**Usage**: Full data export for backup or migration.

---

### CSV Export

```typescript
interface CSVExport {
  // Transaction CSV: date, account, category, amount, description, status
  transactionsCsv: string;
  
  // Summary CSV: category, totalIncome, totalExpense, net
  summaryCsv: string;
  
  // Fuel CSV: vehicle, date, liters, cost, efficiency
  fuelLogsCsv: string;
}
```

---

## Store Hook Contracts

### useTransactionsStore()

```typescript
interface TransactionsStore {
  transactions: Transaction[];
  loading: boolean;
  
  load(since?: string): Promise<void>;
  add(t: Omit<Transaction, 'id'>): Promise<string>;  // Returns new ID
  update(t: Transaction): Promise<void>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
}
```

---

### useAccountsStore()

```typescript
interface AccountsStore {
  accounts: Account[];
  
  load(): Promise<void>;
  add(a: Omit<Account, 'id'>): Promise<string>;
  update(a: Account): Promise<void>;
  remove(id: string): Promise<void>;
}
```

---

### useSettingsStore()

```typescript
interface SettingsStore {
  baseCurrency: string;
  language: 'en' | 'es';
  theme: 'light' | 'dark' | 'system';
  googleClientId: string;
  
  load(): Promise<void>;
  saveSetting(key: SettingKey, value: string): Promise<void>;
}
```

---

### useExchangeRatesStore()

```typescript
interface ExchangeRatesStore {
  rates: ExchangeRate[];
  isFetching: boolean;
  
  load(): Promise<void>;
  fetchFromApi(baseCurrency: string): Promise<void>;
  fetchSinglePairRate(from: string, to: string): Promise<number>;
  addManual(rate: Omit<ExchangeRate, 'id'>): Promise<string>;
  remove(id: string): Promise<void>;
  getRateForPair(from: string, to: string): number | null;
}
```

---

## Error Contracts

### User-Facing Errors

All user-facing errors are surfaced via `sonner` toast:

```typescript
toast.error('Unable to save transaction. Check your connection.');
```

### Developer Errors

All Dexie errors are caught in store mutations:

```typescript
try {
  await db.transactions.add(transaction);
  // ...
} catch (error) {
  console.error('Failed to add transaction', error);
  toast.error('Unable to save transaction.');
}
```

---

## Validation Schemas

All form inputs validated via **zod** schemas:

- [Transactions](../src/features/transactions/schemas/)
- [Budgets](../src/features/budgets/schemas/)
- [Vehicles](../src/features/vehicles/schemas/)
- [Accounts](../src/features/settings/schemas/)

Each schema validates:
- Required fields
- Field types and formats
- Business rule constraints (e.g., amount > 0, future dates for pending)

---

## Dexie Schema Version History

| Version | Change | Migration |
|---------|--------|-----------|
| 1 | Initial schema | N/A |
| 2 | Added `budgets` table | Auto-create empty table |
| — | — | — |

See [src/db/index.ts](../src/db/index.ts) for full version history.
