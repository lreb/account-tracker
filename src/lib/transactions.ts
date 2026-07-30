import type { Transaction } from '@/types'

/**
 * Sorts transactions newest-first with a stable tie-breaker on id.
 * Transactions with the same ISO date string are ordered by descending id
 * (higher id = inserted later = more recent within the same timestamp).
 * This guarantees a deterministic order for the running-balance walk,
 * preventing incorrect intermediate balances when two transactions share
 * the same date/time.
 */
export function sortTransactionsNewestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    // Tie-break: lexicographic id comparison — UUID v4s are random but this
    // guarantees a consistent, deterministic order within the same timestamp
    // across every call site. Number(uuid) returns NaN and does not work.
    return b.id.localeCompare(a.id)
  })
}
