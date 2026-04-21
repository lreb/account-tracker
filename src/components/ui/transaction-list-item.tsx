import { Link } from 'react-router-dom'

import { formatCurrency } from '@/lib/currency'
import type { Label } from '@/types'

export interface TxBalanceEntry {
  accountName: string
  balance: number
  currency: string
}

interface TransactionListItemProps {
  description: string
  notes?: string
  status: string
  timeStr: string
  categoryName: string
  resolvedLabels: Label[]
  linkTo: string
  amount: number
  amountPrefix: string
  amountCurrency: string
  txType: 'income' | 'expense' | 'transfer'
  primaryBalance?: TxBalanceEntry
  secondaryBalance?: TxBalanceEntry
}

export function TransactionListItem({
  description,
  notes,
  status,
  timeStr,
  categoryName,
  resolvedLabels,
  linkTo,
  amount,
  amountPrefix,
  amountCurrency,
  txType,
  primaryBalance,
  secondaryBalance,
}: TransactionListItemProps) {
  return (
    <div className="pb-2">
      <Link
        to={linkTo}
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
          status === 'cancelled'
            ? 'bg-gray-50 border-gray-200 opacity-60'
            : 'bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${status === 'cancelled' ? 'line-through text-gray-400' : ''}`}>
            {description}
          </p>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <p className="text-xs text-gray-400">{categoryName || '—'}</p>
            <p className="text-xs text-gray-400">{timeStr}</p>
            {notes && (
              <p className="text-xs text-gray-400 italic truncate">{notes}</p>
            )}
          </div>
          {resolvedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {resolvedLabels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                  style={{
                    borderColor: lbl.color ?? '#6b7280',
                    color: lbl.color ?? '#6b7280',
                    backgroundColor: `${lbl.color ?? '#6b7280'}18`,
                  }}
                >
                  {lbl.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold ${status === 'cancelled' ? 'text-gray-400 line-through' : txType === 'income' ? 'text-green-600' : txType === 'expense' ? 'text-red-500' : 'text-blue-600'}`}>
            {amountPrefix}
            {formatCurrency(amount, amountCurrency)}
          </p>
          {(primaryBalance ?? secondaryBalance) && (
            <div className="mt-0.5 space-y-0.5">
              {primaryBalance && (
                <p className="text-[11px] text-gray-400">
                  {primaryBalance.accountName}:{' '}
                  <span className={primaryBalance.balance < 0 ? 'text-red-400' : 'text-gray-500'}>
                    {formatCurrency(primaryBalance.balance, primaryBalance.currency)}
                  </span>
                </p>
              )}
              {secondaryBalance && (
                <p className="text-[11px] text-gray-400">
                  {secondaryBalance.accountName}:{' '}
                  <span className={secondaryBalance.balance < 0 ? 'text-red-400' : 'text-gray-500'}>
                    {formatCurrency(secondaryBalance.balance, secondaryBalance.currency)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
