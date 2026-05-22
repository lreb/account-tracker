import { getAccountTransactionAmount } from '@/lib/balance-sheet'
import type { Account, Transaction } from '@/types'

export interface TransactionPresentation {
  amount: number
  prefix: '+' | '-'
  labelKey: string
  currency: string
}

export function getTransactionPresentation(
  transaction: Transaction,
  account: Account,
): TransactionPresentation {
  const signedAmount = getAccountTransactionAmount(transaction, account)
  const absoluteAmount = Math.abs(signedAmount)

  if (transaction.type === 'transfer') {
    const isIncoming = transaction.toAccountId === account.id
    return {
      amount: absoluteAmount,
      prefix: isIncoming ? '+' : '-',
      labelKey: isIncoming
        ? 'balanceSheet.transactionKinds.transferIn'
        : 'balanceSheet.transactionKinds.transferOut',
      currency: account.currency,
    }
  }

  return {
    amount: absoluteAmount,
    prefix: signedAmount >= 0 ? '+' : '-',
    labelKey: transaction.type === 'income' ? 'transactions.income' : 'transactions.expense',
    currency: transaction.currency,
  }
}
