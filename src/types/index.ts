// ─── Enums / union types ────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'pending' | 'cleared' | 'reconciled' | 'cancelled'
export type AccountType = 'asset' | 'liability'
export type CategoryType = 'income' | 'expense' | 'any'
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly'
export type AppTheme = 'light' | 'dark' | 'system'

// ─── Core domain types ───────────────────────────────────────────────────────

export interface Transaction {
  id: string
  type: TransactionType
  amount: number              // integer cents in account's currency
  date: string                // ISO 8601
  categoryId: string
  accountId: string           // source account
  toAccountId?: string        // destination account (transfers only)
  description: string
  notes?: string
  status: TransactionStatus
  labels?: string[]           // label ids
  currency: string            // ISO 4217
  exchangeRate?: number       // rate vs. baseCurrency at time of entry
  originalAmount?: number     // source-currency cents (cross-currency transfers)
  originalCurrency?: string   // source currency code (cross-currency transfers)
  transferId?: string         // links the two sides of a transfer
}

export interface Account {
  id: string
  name: string
  type: AccountType
  subtype?: string           // optional account subtype (e.g. checking, credit-card)
  openingBalance: number      // integer cents in account's currency
  currency: string            // ISO 4217
  hidden?: boolean            // excluded from app totals and account selectors
}

export interface Category {
  id: string
  name: string
  icon: string                // lucide icon name
  isCustom: boolean
  type: CategoryType          // 'income' | 'expense' | 'any'
  deletedAt?: string          // ISO 8601 — set when soft-deleted, absent when active
}

export interface Label {
  id: string
  name: string
  color?: string              // hex color for badge UI
}

export interface ExchangeRate {
  id: string
  fromCurrency: string        // ISO 4217
  toCurrency: string          // ISO 4217
  rate: number                // up to 6 decimal places
  date: string                // ISO 8601
}

export interface Setting {
  key: string                 // e.g. 'baseCurrency', 'language', 'theme'
  value: string
}

export interface Budget {
  id: string
  categoryId: string
  amount: number              // limit in baseCurrency cents
  period: BudgetPeriod
  rollover: boolean
  startDate: string           // ISO 8601
  endDate?: string            // ISO 8601 — open-ended if omitted
  currency: string            // must match baseCurrency
}

export interface Vehicle {
  id: string
  name: string
  make?: string
  model?: string
  year?: number
  initialOdometer?: number   // km at registration
  archivedAt?: string        // ISO 8601 — set when archived, absent when active
}

export interface FuelLog {
  id: string
  vehicleId: string
  date: string                // ISO 8601
  liters: number
  totalCost: number           // integer cents
  odometer: number            // km reading at fill-up
  notes?: string
  transactionId?: string      // linked expense transaction
}

export interface VehicleService {
  id: string
  vehicleId: string
  date: string                // ISO 8601
  serviceType: string
  cost: number                // integer cents
  odometer: number
  notes?: string
  nextServiceKm?: number
  nextServiceDate?: string    // ISO 8601
  transactionId?: string      // linked expense transaction
}
