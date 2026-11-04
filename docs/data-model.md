# Data Model and Contracts

`src/types/index.ts` wins if this file and the source diverge. `src/db/index.ts` is the schema history (current version 9). `src/lib/backup.ts` is the backup envelope.

## Transaction
```ts
interface Transaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  date: string
  categoryId: string
  accountId: string
  toAccountId?: string
  description: string
  notes?: string
  status: 'pending' | 'cleared' | 'reconciled' | 'cancelled'
  labels?: string[]
  currency: string
  exchangeRate?: number
  originalAmount?: number
  originalCurrency?: string
  transferId?: string
}
```
`amount` is an integer minor-unit value. `exchangeRate` converts that account currency into base currency. Linked transfer records share `transferId`.

## Account
```ts
interface Account {
  id: string
  name: string
  type: 'asset' | 'liability'
  subtype?: string
  openingBalance: number
  currency: string
  hidden?: boolean
  cancelled?: boolean
}
```
`cancelled` excludes the account from calculations. `hidden` only omits it from default reports and selectors.

## Category and Label
```ts
interface Category {
  id: string
  name: string
  icon: string
  isCustom: boolean
  type: 'income' | 'expense' | 'any'
  deletedAt?: string
}
interface Label { id: string; name: string; color?: string }
```

## Budget
```ts
interface Budget {
  id: string
  categoryId: string
  amount: number
  period: 'weekly' | 'monthly' | 'yearly'
  rollover: boolean
  startDate: string
  endDate?: string
  currency: string
}
```

## Vehicle records
```ts
interface Vehicle {
  id: string
  name: string
  make?: string
  model?: string
  year?: number
  initialOdometer?: number
  odometerUnit?: 'km' | 'mi'
  archivedAt?: string
}
interface FuelLog {
  id: string
  vehicleId: string
  date: string
  liters: number
  totalCost: number
  odometer: number
  notes?: string
  transactionId?: string
}
interface VehicleService {
  id: string
  vehicleId: string
  date: string
  serviceType: string
  cost: number
  odometer: number
  notes?: string
  nextServiceKm?: number
  nextServiceDate?: string
  transactionId?: string
}
```

## Exchange rate
```ts
interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  date: string
}
```

## Recurring transaction
```ts
interface RecurringTransaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  categoryId: string
  accountId: string
  toAccountId?: string
  description: string
  notes?: string
  status: 'pending' | 'cleared' | 'reconciled' | 'cancelled'
  labels?: string[]
  currency: string
  exchangeRate?: number
  interval: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  startDate: string
  time: string
  totalOccurrences: number
  occurrencesFired: number
  nextDueDate: string
  createdAt: string
  active: boolean
}
```
A recurring row is a reminder template. It is not a posted transaction until applied.

## Settings
Settings are string-valued key/value records (`Setting { key, value }`). Supported keys are defined in source. `aiApiKey` is stored locally and filtered out of backups. No `retentionDays` setting controls deletion; retention is manual compaction.

## AI analysis cache
```ts
interface AiAnalysis {
  id: string
  period: string
  scopeDays: string | number
  prompt: string
  response: string
  provider: string
  model: string
  transactionCount: number
  createdAt: string
}
```
`scopeDays` is a named scope (`current-month`, `last-month`, `last-3-months`, `last-quarter`, `last-6-months`, `last-year`) or `30 | 90 | 365`. Cache freshness must also consider period/scope and data changes. Retain analyses for 12 months and load at most the latest 24 into memory.

## Backup envelope
```ts
interface FullBackup {
  version: number
  exportedAt: string
  data: {
    transactions: Transaction[]
    accounts: Account[]
    categories: Category[]
    labels: Label[]
    exchangeRates: ExchangeRate[]
    settings: Setting[]
    budgets: Budget[]
    vehicles: Vehicle[]
    fuelLogs: FuelLog[]
    vehicleServices: VehicleService[]
    recurringTransactions: RecurringTransaction[]
  }
}
```
Current `version` is `1` (`BACKUP_VERSION`). Import validates version, structure and records before an atomic replacement. Secrets and tokens are never exported. `aiAnalyses` is not part of the backup.

## Store contract
Each domain store exposes state, `load()` and explicit mutations. Mutations persist through Dexie and update Zustand consistently. Components never bypass the store.

## Dexie tables
Version 9 stores: `transactions`, `accounts`, `categories`, `labels`, `exchangeRates`, `settings`, `budgets`, `vehicles`, `fuelLogs`, `vehicleServices`, `recurringTransactions`, `aiAnalyses`.

## Dexie migrations
- Add a new `.version(n)` for structural changes.
- Never rewrite an existing version.
- Add migration tests for transformations.
- `src/db/index.ts` is the authoritative schema history.
