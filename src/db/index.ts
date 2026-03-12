// Current DB version: 4
import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Budget,
  Category,
  ExchangeRate,
  FuelLog,
  Label,
  Setting,
  Transaction,
  Vehicle,
  VehicleService,
} from '@/types'

class ExpenseTrackingDB extends Dexie {
  transactions!: Table<Transaction, string>
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  labels!: Table<Label, string>
  exchangeRates!: Table<ExchangeRate, string>
  settings!: Table<Setting, string>
  budgets!: Table<Budget, string>
  vehicles!: Table<Vehicle, string>
  fuelLogs!: Table<FuelLog, string>
  vehicleServices!: Table<VehicleService, string>

  constructor() {
    super('ExpenseTracking')
    this.version(1).stores({
      transactions: 'id, date, accountId, toAccountId, categoryId, type, status, transferId',
      accounts:     'id, type, currency',
      categories:   'id, isCustom',
      labels:       'id',
      exchangeRates:'id, fromCurrency, toCurrency, date',
      settings:     'key',
      budgets:      'id, categoryId, period',
      vehicles:     'id',
      fuelLogs:     'id, vehicleId, date',
      vehicleServices: 'id, vehicleId, date',
    })
    // Version 2: index archivedAt on vehicles for active/archived filtering
    this.version(2).stores({
      vehicles: 'id, archivedAt',
    })
    // Version 3: add type index on categories
    this.version(3).stores({
      categories: 'id, isCustom, type',
    }).upgrade(tx => {
      return tx.table('categories').toCollection().modify(cat => {
        if (!cat.type) cat.type = 'expense'
      })
    })
    // Version 4: add deletedAt index on categories for soft-delete
    this.version(4).stores({
      categories: 'id, isCustom, type, deletedAt',
    })
  }
}

export const db = new ExpenseTrackingDB()
