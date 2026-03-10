import { db } from '@/db'
import { getPeriodRange } from './dates'
import type { Budget } from '@/types'

export interface BudgetUsage {
  spent: number    // integer cents
  limit: number    // integer cents
  percent: number  // 0–100+ where 100 = at limit
}

/**
 * Calculate how much of a budget has been spent in the current period.
 * Consumption is calculated at read time — never stored as a derived field.
 */
export async function getBudgetUsage(budget: Budget): Promise<BudgetUsage> {
  const { start, end } = getPeriodRange(budget.period)
  const startStr = start.toISOString()
  const endStr = end.toISOString()

  const transactions = await db.transactions
    .where('categoryId')
    .equals(budget.categoryId)
    .filter(t => t.type === 'expense' && t.date >= startStr && t.date <= endStr)
    .toArray()

  const spent = transactions.reduce((sum, t) => sum + t.amount, 0)
  const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0

  return { spent, limit: budget.amount, percent }
}
