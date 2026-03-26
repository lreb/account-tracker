import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TransactionStatus } from '@/types'

const STATUSES: TransactionStatus[] = ['cleared', 'pending', 'reconciled', 'cancelled']

interface StatusSelectProps {
  value: TransactionStatus
  onChange: (value: TransactionStatus) => void
}

export function StatusSelect({ value, onChange }: StatusSelectProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-1">
      <Label>{t('transactions.statusLabel')}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as TransactionStatus)}>
        <SelectTrigger>
          <SelectValue>{t(`transactions.status.${value}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {t(`transactions.status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
