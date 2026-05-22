import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
} from 'date-fns'

/**
 * Creates an explicit local-time Date boundary for the given date.
 * No `Z` suffix — interpreted in the device's local timezone, which matches
 * how transaction dates are stored and compared.
 * @see docs/architecture.md — "Date / Time Handling"
 */
export function localDay(d: Date, endOfDay = false): Date {
  const ymd = format(d, 'yyyy-MM-dd')
  return endOfDay
    ? new Date(`${ymd}T23:59:59.999`)
    : new Date(`${ymd}T00:00:00.000`)
}

// ─── Weekly preset (used by Category Expenses / Incomes and Label reports) ────

export type WeeklyPresetKey = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

export function getWeeklyPresetRange(key: WeeklyPresetKey): { from: Date; to: Date } {
  const today = new Date()
  switch (key) {
    case 'thisWeek':
      return {
        from: localDay(startOfWeek(today, { weekStartsOn: 1 })),
        to:   localDay(endOfWeek(today,   { weekStartsOn: 1 }), true),
      }
    case 'thisMonth':
      return { from: localDay(startOfMonth(today)), to: localDay(endOfMonth(today), true) }
    case 'lastMonth': {
      const lm = subMonths(today, 1)
      return { from: localDay(startOfMonth(lm)), to: localDay(endOfMonth(lm), true) }
    }
    case 'thisYear':
      return { from: localDay(startOfYear(today)), to: localDay(endOfYear(today), true) }
    case 'custom':
      return { from: localDay(startOfMonth(today)), to: localDay(endOfMonth(today), true) }
  }
}

// ─── Monthly preset (used by the main Reports overview page) ──────────────────

export type MonthlyPresetKey = 'thisMonth' | 'lastMonth' | 'last3' | 'last6' | 'thisYear' | 'custom'

export function getMonthlyPresetRange(key: MonthlyPresetKey): { from: Date; to: Date } {
  const today = new Date()
  switch (key) {
    case 'thisMonth':
      return { from: localDay(startOfMonth(today)),           to: localDay(endOfMonth(today), true) }
    case 'lastMonth': {
      const lm = subMonths(today, 1)
      return { from: localDay(startOfMonth(lm)),              to: localDay(endOfMonth(lm), true) }
    }
    case 'last3':
      return { from: localDay(startOfMonth(subMonths(today, 2))), to: localDay(endOfMonth(today), true) }
    case 'last6':
      return { from: localDay(startOfMonth(subMonths(today, 5))), to: localDay(endOfMonth(today), true) }
    case 'thisYear':
      return { from: localDay(startOfYear(today)),            to: localDay(endOfYear(today), true) }
    case 'custom':
      return { from: localDay(startOfMonth(today)),           to: localDay(endOfMonth(today), true) }
  }
}
