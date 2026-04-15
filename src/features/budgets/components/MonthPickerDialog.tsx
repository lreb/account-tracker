import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { startOfMonth, isSameMonth, getYear, setYear, setMonth } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function MonthPickerDialog({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean
  current: Date
  onSelect: (d: Date) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [year, setPickerYear] = useState(getYear(current))
  const today = new Date()

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('budgets.selectMonth')}</DialogTitle>
        </DialogHeader>

        {/* Year navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setPickerYear((y) => y - 1)}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold">{year}</span>
          <button
            type="button"
            onClick={() => setPickerYear((y) => y + 1)}
            className="rounded-full p-1.5 hover:bg-gray-100"
            disabled={year >= getYear(today)}
          >
            <ChevronRight size={16} className={year >= getYear(today) ? 'text-gray-300' : ''} />
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, idx) => {
            const candidate = startOfMonth(setMonth(setYear(new Date(), year), idx))
            const isSelected = isSameMonth(candidate, current)
            const isFuture = candidate > startOfMonth(today)
            return (
              <button
                key={name}
                type="button"
                disabled={isFuture}
                onClick={() => { onSelect(candidate); onClose() }}
                className={`rounded-xl py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isFuture
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { onSelect(startOfMonth(today)); onClose() }}
          >
            {t('budgets.today')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
