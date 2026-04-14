import { useMemo } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { Transaction } from '@/types'

export type FlatTransactionItem =
  | { kind: 'header'; dateKey: string; headerLabel: string; count: number }
  | { kind: 'tx'; tx: Transaction; timeStr: string }

/**
 * Groups `transactions` by local calendar date and flattens the result into
 * an array of header + row items ready for rendering (virtual or plain list).
 *
 * Uses `format(new Date(tx.date), 'yyyy-MM-dd')` to derive the local date so
 * that a UTC timestamp crossing midnight (e.g. stored as next-day UTC) is
 * always bucketed by the user's local date — not the UTC date.
 */
export function useGroupedTransactions(transactions: Transaction[]): FlatTransactionItem[] {
  const { t } = useTranslation()

  return useMemo(() => {
    const result: FlatTransactionItem[] = []
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })

    const map = new Map<string, Transaction[]>()
    for (const tx of transactions) {
      const key = format(new Date(tx.date), 'yyyy-MM-dd')
      const arr = map.get(key)
      if (arr) arr.push(tx)
      else map.set(key, [tx])
    }

    for (const [dateKey, txs] of map) {
      const d = parseISO(dateKey)
      const headerLabel = isToday(d)
        ? t('transactions.today')
        : isYesterday(d)
          ? t('transactions.yesterday')
          : format(d, 'EEEE, MMM d, yyyy')
      result.push({ kind: 'header', dateKey, headerLabel, count: txs.length })
      for (const tx of txs) {
        result.push({ kind: 'tx', tx, timeStr: timeFormatter.format(new Date(tx.date)) })
      }
    }

    return result
  }, [transactions, t])
}
