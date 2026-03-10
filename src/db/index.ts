// Current DB version: 1
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
  }
}

export const db = new ExpenseTrackingDB()
