import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getTranslatedCategoryName } from '@/lib/categories'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category } from '@/types'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  /** Pre-filtered list of categories to show */
  options: Category[]
  error?: string
}

export function CategorySelect({ value, onChange, options, error }: CategorySelectProps) {
  const { t } = useTranslation()

  const sorted = useMemo(
    () =>
      [...options].sort((a, b) =>
        getTranslatedCategoryName(a, t).localeCompare(getTranslatedCategoryName(b, t)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options],
  )

  return (
    <div className="space-y-1">
      <Label>{t('settings.categories')}</Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger>
          <SelectValue placeholder={t('transactions.selectCategory')}>
            {getTranslatedCategoryName(options.find((c) => c.id === value), t)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sorted.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {getTranslatedCategoryName(cat, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
