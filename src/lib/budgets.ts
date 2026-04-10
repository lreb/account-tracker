import { db } from '@/db'
import { isTransactionForVisiblePrimaryAccount } from './accounts'
import { getPeriodRange } from './dates'
import type { Budget } from '@/types'

export interface BudgetUsage {
  spent: number    // integer cents
  limit: number    // integer cents (effective limit after rollover)
  percent: number  // 0–100+ where 100 = at limit
  rolloverAmount: number  // integer cents carried over from previous period (0 if no rollover)
}

/**
 * Calculate how much of a budget has been spent in the period that contains `referenceDate`.
 * When `budget.rollover` is true, unspent balance from the previous period is added to the limit.
 * Consumption is calculated at read time — never stored as a derived field.
 */
export async function getBudgetUsage(
  budget: Budget,
  visibleAccountIds?: Set<string>,
  referenceDate: Date = new Date(),
): Promise<BudgetUsage> {
  const { start, end } = getPeriodRange(budget.period, referenceDate)
  const startStr = start.toISOString()
  const endStr = end.toISOString()

  const transactions = await db.transactions
    .where('categoryId')
    .equals(budget.categoryId)
    .filter(t => t.type === 'expense' && t.date >= startStr && t.date <= endStr)
    .toArray()

  const spent = transactions.reduce((sum, transaction) => {
    if (visibleAccountIds && !isTransactionForVisiblePrimaryAccount(transaction, visibleAccountIds)) {
      return sum
    }
    return sum + transaction.amount
  }, 0)

  // Rollover: calculate previous period's unspent balance
  let rolloverAmount = 0
  if (budget.rollover) {
    const { start: prevStart, end: prevEnd } = getPeriodRange(budget.period, new Date(start.getTime() - 1))
    const prevStartStr = prevStart.toISOString()
    const prevEndStr = prevEnd.toISOString()

    const prevTransactions = await db.transactions
      .where('categoryId')
      .equals(budget.categoryId)
      .filter(t => t.type === 'expense' && t.date >= prevStartStr && t.date <= prevEndStr)
      .toArray()

    const prevSpent = prevTransactions.reduce((sum, transaction) => {
      if (visibleAccountIds && !isTransactionForVisiblePrimaryAccount(transaction, visibleAccountIds)) {
        return sum
      }
      return sum + transaction.amount
    }, 0)

    const prevUnspent = budget.amount - prevSpent
    if (prevUnspent > 0) rolloverAmount = prevUnspent
  }

  const effectiveLimit = budget.amount + rolloverAmount
  const percent = effectiveLimit > 0 ? Math.round((spent / effectiveLimit) * 100) : 0

  return { spent, limit: effectiveLimit, percent, rolloverAmount }
}
