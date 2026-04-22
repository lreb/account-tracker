import { addDays, addMonths, addWeeks, addYears, format, parseISO } from 'date-fns'
import type { RecurringInterval, RecurringTransaction } from '@/types'

/** Compute the next due date given the current one and the interval. */
export function advanceDueDate(currentDate: string, interval: RecurringInterval): string {
  const d = parseISO(currentDate)
  switch (interval) {
    case 'daily':    return format(addDays(d, 1),    'yyyy-MM-dd')
    case 'weekly':   return format(addWeeks(d, 1),   'yyyy-MM-dd')
    case 'biweekly': return format(addWeeks(d, 2),   'yyyy-MM-dd')
    case 'monthly':  return format(addMonths(d, 1),  'yyyy-MM-dd')
    case 'yearly':   return format(addYears(d, 1),   'yyyy-MM-dd')
  }
}

/** Returns all recurring transactions that are currently due (nextDueDate ≤ today). */
export function getDueRecurring(items: RecurringTransaction[]): RecurringTransaction[] {
  const today = format(new Date(), 'yyyy-MM-dd')
  return items.filter(
    (r) => r.active && r.occurrencesFired < r.totalOccurrences && r.nextDueDate <= today,
  )
}

/** Returns true when a recurring transaction has no remaining occurrences. */
export function isRecurringCompleted(r: RecurringTransaction): boolean {
  return r.occurrencesFired >= r.totalOccurrences
}
