# Data Model and Contracts

Source TypeScript definitions remain implementation truth. This document records stable semantic contracts.

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
  createdAt?: string
  updatedAt?: string
}
```
`amount` is an integer minor-unit value. Linked transfer records share `transferId`.

## Account
```ts
interface Account {
  id: string
  name: string
  type: 'cash' | 'bank' | 'card' | 'savings' | 'investment' | 'other'
  openingBalance: number
  currency: string
  hidden?: boolean
  archived?: boolean
  createdAt?: string
  updatedAt?: string
}
```

## Category and Label
```ts
interface Category {
  id: string
  name: string
  icon: string
  isCustom: boolean
  color?: string
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
  archived?: boolean
}
interface FuelLog {
  id: string
  vehicleId: string
  date: string
  liters: number
  totalCost: number
  odometer: number
  linkedTransactionId?: string
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
  linkedTransactionId?: string
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
  source: 'frankfurter' | 'manual'
}
```

## Settings
Settings are string-valued key/value records. Supported keys are defined in source. Sensitive AI credentials must be marked non-exportable. No `retentionDays` setting controls deletion; retention is manual compaction.

## AI analysis cache
```ts
interface AiAnalysis {
  id: string
  period: string
  scopeDays: 30 | 90 | 365
  prompt: string
  response: string
  provider: string
  model: string
  transactionCount: number
  createdAt: string
}
```
Cache freshness must also consider period/scope and data changes. Retain analyses for 12 months and load at most the latest 24 into memory.

## Backup envelope
```ts
interface BackupData {
  version: string
  exportDate: string
  tables: Record<string, unknown[]>
}
```
The exact table list is versioned in source. Import validates version, structure and records before an atomic replacement. Secrets and tokens are never exported.

## Store contract
Each domain store exposes state, `load()` and explicit mutations. Mutations persist through Dexie and update Zustand consistently. Components never bypass the store.

## Dexie migrations
- Add a new `.version(n)` for structural changes.
- Never rewrite an existing version.
- Add migration tests for transformations.
- `src/db/index.ts` is the authoritative schema history.
