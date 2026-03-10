import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import type { BudgetPeriod } from '@/types'

export function getPeriodRange(period: BudgetPeriod, date = new Date()): { start: Date; end: Date } {
  switch (period) {
    case 'weekly':
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      }
    case 'monthly':
      return { start: startOfMonth(date), end: endOfMonth(date) }
    case 'yearly':
      return { start: startOfYear(date), end: endOfYear(date) }
  }
}
