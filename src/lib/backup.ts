import { db } from '@/db'
import type {
  Account, Budget, Category, ExchangeRate,
  FuelLog, Label, Setting, Transaction,
  Vehicle, VehicleService,
} from '@/types'

export const BACKUP_VERSION = 1

export interface FullBackup {
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
  }
}

/** Reads every Dexie table and returns a serialisable snapshot. */
export async function buildFullBackup(): Promise<FullBackup> {
  const [
    transactions, accounts, categories, labels,
    exchangeRates, settings, budgets, vehicles,
    fuelLogs, vehicleServices,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    db.labels.toArray(),
    db.exchangeRates.toArray(),
    db.settings.toArray(),
    db.budgets.toArray(),
    db.vehicles.toArray(),
    db.fuelLogs.toArray(),
    db.vehicleServices.toArray(),
  ])

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      transactions, accounts, categories, labels,
      exchangeRates, settings, budgets, vehicles,
      fuelLogs, vehicleServices,
    },
  }
}

/** Triggers a browser file download of the backup JSON. */
export function downloadBackupFile(backup: FullBackup, filename: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Parses and validates a backup JSON string from a file or Drive download. */
export function parseBackupFile(text: string): FullBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON — file could not be parsed.')
  }
  if (
    typeof parsed !== 'object' || parsed === null ||
    !('version' in parsed) || !('data' in parsed) ||
    typeof (parsed as Record<string, unknown>).data !== 'object'
  ) {
    throw new Error('Unrecognised backup format — missing version or data fields.')
  }
  return parsed as FullBackup
}

/**
 * Wipes all Dexie tables and bulk-inserts the backup data.
 * Call all store.load() functions (or window.location.reload()) after this.
 */
export async function restoreFromBackup(backup: FullBackup): Promise<void> {
  const { data } = backup

  // Clear all tables first
  await Promise.all([
    db.transactions.clear(), db.accounts.clear(), db.categories.clear(),
    db.labels.clear(), db.exchangeRates.clear(), db.settings.clear(),
    db.budgets.clear(), db.vehicles.clear(), db.fuelLogs.clear(),
    db.vehicleServices.clear(),
  ])

  // Re-populate with backup data
  await Promise.all([
    data.transactions.length > 0 ? db.transactions.bulkPut(data.transactions) : Promise.resolve(),
    data.accounts.length > 0 ? db.accounts.bulkPut(data.accounts) : Promise.resolve(),
    data.categories.length > 0 ? db.categories.bulkPut(data.categories) : Promise.resolve(),
    data.labels.length > 0 ? db.labels.bulkPut(data.labels) : Promise.resolve(),
    data.exchangeRates.length > 0 ? db.exchangeRates.bulkPut(data.exchangeRates) : Promise.resolve(),
    data.settings.length > 0 ? db.settings.bulkPut(data.settings) : Promise.resolve(),
    data.budgets.length > 0 ? db.budgets.bulkPut(data.budgets) : Promise.resolve(),
    data.vehicles.length > 0 ? db.vehicles.bulkPut(data.vehicles) : Promise.resolve(),
    data.fuelLogs.length > 0 ? db.fuelLogs.bulkPut(data.fuelLogs) : Promise.resolve(),
    data.vehicleServices.length > 0 ? db.vehicleServices.bulkPut(data.vehicleServices) : Promise.resolve(),
  ])
}

/**
 * Permanently deletes all data from every table — factory reset.
 * Call all store.load() functions after this.
 */
export async function resetApp(): Promise<void> {
  await Promise.all([
    db.transactions.clear(), db.accounts.clear(), db.categories.clear(),
    db.labels.clear(), db.exchangeRates.clear(), db.settings.clear(),
    db.budgets.clear(), db.vehicles.clear(), db.fuelLogs.clear(),
    db.vehicleServices.clear(),
  ])
}
