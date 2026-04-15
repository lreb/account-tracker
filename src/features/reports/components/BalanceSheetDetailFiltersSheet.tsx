import { useTranslation } from 'react-i18next'

import { BALANCE_SHEET_PRESETS, type BalanceSheetPreset } from '@/lib/balance-sheet'
import type { Label, Category } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { getTranslatedCategoryName } from '@/lib/categories'
import { CategoryIcon } from '@/lib/icon-map'

import type { DetailFilters, TxStatus } from './balance-sheet-detail-filters.types'

const STATUS_OPTIONS: { value: TxStatus; label: string }[] = [
  { value: 'cleared',    label: 'transactions.status.cleared' },
  { value: 'pending',    label: 'transactions.status.pending' },
  { value: 'reconciled', label: 'transactions.status.reconciled' },
  { value: 'cancelled',  label: 'transactions.status.cancelled' },
]

interface BalanceSheetDetailFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: DetailFilters
  onDraftChange: (updater: (prev: DetailFilters) => DetailFilters) => void
  draftPeriod: BalanceSheetPreset
  onDraftPeriodChange: (preset: BalanceSheetPreset) => void
  categories: Category[]
  labels: Label[]
  onApply: () => void
  onReset: () => void
}

export function BalanceSheetDetailFiltersSheet({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  draftPeriod,
  onDraftPeriodChange,
  categories,
  labels,
  onApply,
  onReset,
}: BalanceSheetDetailFiltersSheetProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-5 pt-2 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('transactions.filters.title')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Period */}
          <div className="space-y-2">
            <FormLabel>{t('balanceSheet.filters.title')}</FormLabel>
            <div className="flex flex-wrap gap-2">
              {BALANCE_SHEET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onDraftPeriodChange(preset)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    draftPeriod === preset
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {t(`balanceSheet.periods.${preset}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Keyword */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.filters.keyword')}</FormLabel>
            <Input
              placeholder={t('transactions.filters.keywordPlaceholder')}
              value={draft.search}
              onChange={(e) => onDraftChange((p) => ({ ...p, search: e.target.value }))}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>{t('transactions.filters.dateFrom')}</FormLabel>
              <Input
                type="date"
                value={draft.dateFrom}
                onChange={(e) => onDraftChange((p) => ({ ...p, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <FormLabel>{t('transactions.filters.dateTo')}</FormLabel>
              <Input
                type="date"
                value={draft.dateTo}
                onChange={(e) => onDraftChange((p) => ({ ...p, dateTo: e.target.value }))}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <FormLabel>{t('transactions.filters.status')}</FormLabel>
            <Select
              value={draft.status || '__all__'}
              onValueChange={(v) => onDraftChange((p) => ({ ...p, status: v === '__all__' ? '' : v as TxStatus }))}
            >
              <SelectTrigger>
                <SelectValue>
                  {draft.status ? t(`transactions.status.${draft.status}`) : t('transactions.filters.allStatuses')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('transactions.filters.allStatuses')}</SelectItem>
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{t(label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="space-y-1">
              <FormLabel>{t('transactions.filters.category')}</FormLabel>
              <Select
                value={draft.categoryId || '__all__'}
                onValueChange={(v) => onDraftChange((p) => ({ ...p, categoryId: v === '__all__' ? '' : (v ?? '') }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.categoryId
                      ? getTranslatedCategoryName(categories.find((c) => c.id === draft.categoryId), t)
                      : t('transactions.filters.allCategories')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allCategories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={cat.icon} size={14} className="text-gray-500 shrink-0" />
                        {getTranslatedCategoryName(cat, t)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Labels */}
          {labels.length > 0 && (
            <div className="space-y-1">
              <FormLabel>{t('settings.labels')}</FormLabel>
              <Select
                value={draft.labelId || '__all__'}
                onValueChange={(v) => onDraftChange((p) => ({ ...p, labelId: v === '__all__' ? '' : (v ?? '') }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {draft.labelId ? labels.find((l) => l.id === draft.labelId)?.name : t('transactions.filters.allLabels')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('transactions.filters.allLabels')}</SelectItem>
                  {labels.map((lbl) => (
                    <SelectItem key={lbl.id} value={lbl.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: lbl.color ?? '#6b7280' }}
                        />
                        {lbl.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onReset}>{t('transactions.filters.reset')}</Button>
          <Button className="flex-1" onClick={onApply}>{t('transactions.filters.apply')}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
