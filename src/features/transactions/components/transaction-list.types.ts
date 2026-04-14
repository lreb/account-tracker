export type TxListType = 'income' | 'expense' | 'transfer'
export type TxListStatus = 'cleared' | 'pending' | 'reconciled' | 'cancelled'
export type TxListQuickRange = 'all' | '1m' | '3m' | '6m' | '1y' | '2y'

export interface TransactionListFilters {
  search: string
  type: TxListType | ''
  categoryId: string
  accountId: string
  labelId: string
  status: TxListStatus | ''
  dateFrom: string
  dateTo: string
}

export const EMPTY_TX_LIST_FILTERS: TransactionListFilters = {
  search: '',
  type: '',
  categoryId: '',
  accountId: '',
  labelId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

export const DEFAULT_TX_LIST_QUICK_RANGE: TxListQuickRange = '1y'

export interface TxRunningBalance {
  accountBalance: number
  accountCurrency: string
  toAccountBalance?: number
  toAccountCurrency?: string
}
