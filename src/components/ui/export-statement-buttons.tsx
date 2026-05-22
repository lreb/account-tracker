import { Download, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Account, Transaction } from '@/types'
import {
  buildStatementRows,
  exportStatementCsv,
  exportStatementPdf,
  type BalanceMapLike,
  type NamedMapLike,
} from '@/lib/account-statement'
import { Button } from '@/components/ui/button'

export interface ExportStatementButtonsProps {
  transactions: Transaction[]
  account: Account
  /** Map<string, BalanceEntry> where BalanceEntry has at least { accountBalance: number } */
  balanceAfterTx: BalanceMapLike
  categoryMap: NamedMapLike
  labelMap: NamedMapLike
  currentBalance: number
  dateFrom?: string
  dateTo?: string
  disabled?: boolean
}

export function ExportStatementButtons({
  transactions,
  account,
  balanceAfterTx,
  categoryMap,
  labelMap,
  currentBalance,
  dateFrom,
  dateTo,
  disabled = false,
}: ExportStatementButtonsProps) {
  const { t } = useTranslation()

  const isEmpty = disabled || transactions.length === 0

  const handleCsv = () => {
    const rows = buildStatementRows(transactions, account, balanceAfterTx, categoryMap, labelMap)
    exportStatementCsv(rows, { accountName: account.name, currency: account.currency })
  }

  const handlePdf = () => {
    const rows = buildStatementRows(transactions, account, balanceAfterTx, categoryMap, labelMap)
    exportStatementPdf(rows, {
      accountName: account.name,
      currency: account.currency,
      currentBalance,
      dateFrom,
      dateTo,
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCsv}
        disabled={isEmpty}
        title={t('reports.exportCsv')}
        className="h-8 w-8 p-0 sm:w-auto sm:px-2.5"
      >
        <Download size={14} />
        <span className="hidden sm:inline ml-1.5">{t('reports.exportCsv')}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={isEmpty}
        title={t('reports.exportPdf')}
        className="h-8 w-8 p-0 sm:w-auto sm:px-2.5"
      >
        <Printer size={14} />
        <span className="hidden sm:inline ml-1.5">{t('reports.exportPdf')}</span>
      </Button>
    </div>
  )
}
