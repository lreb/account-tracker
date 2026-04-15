export type TxStatus = 'cleared' | 'pending' | 'reconciled' | 'cancelled'

export interface DetailFilters {
  search: string
  status: TxStatus | ''
  categoryId: string
  labelId: string
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: DetailFilters = {
  search: '',
  status: '',
  categoryId: '',
  labelId: '',
  dateFrom: '',
  dateTo: '',
}
