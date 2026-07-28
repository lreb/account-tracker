import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  endOfDay,
  addDays,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { Transaction } from '@/types'
import { buildCalendarDayData, maxDailyExpense } from './DashboardCalendarHeatmap.utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardCalendarHeatmapProps {
  /** Pre-filtered transactions for the visible date range. */
  transactions: Transaction[]
  baseCurrency: string
  /** Start boundary of the selected summary period. */
  from: Date
  /** End boundary of the selected summary period. */
  to: Date
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardCalendarHeatmap({
  transactions,
  baseCurrency,
  from,
  to,
}: DashboardCalendarHeatmapProps) {
  const { t } = useTranslation()

  // Start displaying from the month that contains `from`.
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(from))

  // Sync view month when the `from` boundary changes (e.g. period picker changes).
  // We only reset when the new `from` falls outside the currently viewed month so
  // that navigating inside a long range does not jump back to start.
  const fromMonth = startOfMonth(from)
  if (viewMonth < fromMonth) {
    setViewMonth(fromMonth)
  }

  const toMonth = startOfMonth(to)
  const canPrev = viewMonth > fromMonth
  const canNext = viewMonth < toMonth

  // ── Aggregation ─────────────────────────────────────────────────────────────

  const dayDataMap = useMemo(() => buildCalendarDayData(transactions), [transactions])
  const maxExpense = useMemo(() => maxDailyExpense(dayDataMap), [dayDataMap])

  // ── Calendar grid for current view month ────────────────────────────────────

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) }),
    [viewMonth],
  )

  // Leading blank cells so the first day lands on the correct weekday column.
  // getDay() returns 0 (Sun) – 6 (Sat); week starts on Sunday.
  const leadingBlanks = getDay(days[0])

  // Abbreviated single-letter weekday headers anchored to a known Sunday (Jan 1 2023).
  const weekdayHeaders = useMemo(() => {
    const ref = new Date(2023, 0, 1)
    return Array.from({ length: 7 }, (_, i) => format(addDays(ref, i), 'EEEEE'))
  }, [])

  // ── Selected-day detail panel ────────────────────────────────────────────────

  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Clear selection when the viewed month changes.
  const handlePrev = () => {
    setSelectedKey(null)
    setViewMonth((m) => subMonths(m, 1))
  }
  const handleNext = () => {
    setSelectedKey(null)
    setViewMonth((m) => addMonths(m, 1))
  }

  const selectedData = selectedKey ? (dayDataMap.get(selectedKey) ?? null) : null
  const hasSelectedActivity =
    selectedData !== null && (selectedData.income > 0 || selectedData.expenses > 0)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {/* Title + month navigator */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {t('dashboard.calendarHeatmap.title')}
        </p>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={!canPrev}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={t('dashboard.calendarHeatmap.prevMonth')}
          >
            <ChevronLeft size={14} />
          </button>

          <span className="text-xs font-medium text-gray-700 w-20 text-center select-none">
            {format(viewMonth, 'MMM yyyy')}
          </span>

          <button
            onClick={handleNext}
            disabled={!canNext}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={t('dashboard.calendarHeatmap.nextMonth')}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0" />
          {t('dashboard.calendarHeatmap.income')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block shrink-0" />
          {t('dashboard.calendarHeatmap.expense')}
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdayHeaders.map((d) => (
          <div
            key={d}
            className="text-center text-[9px] text-gray-400 font-medium uppercase select-none"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5" data-testid="calendar-grid">
        {/* Leading blank cells */}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}

        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const data = dayDataMap.get(dateKey) ?? { income: 0, expenses: 0 }

          const inRange = isWithinInterval(startOfDay(day), {
            start: startOfDay(from),
            end: endOfDay(to),
          })

          const hasIncome = data.income > 0
          const hasExpense = data.expenses > 0
          const isSelected = selectedKey === dateKey

          // Red background intensity proportional to expense vs month maximum.
          const expenseAlpha =
            hasExpense && maxExpense > 0
              ? Math.max(0.08, (data.expenses / maxExpense) * 0.55)
              : 0

          const inlineStyle = hasExpense
            ? { backgroundColor: `rgba(239, 68, 68, ${expenseAlpha.toFixed(3)})` }
            : {}

          const titleParts: string[] = []
          if (hasIncome)
            titleParts.push(
              `${t('dashboard.calendarHeatmap.income')}: ${formatCurrency(data.income, baseCurrency)}`,
            )
          if (hasExpense)
            titleParts.push(
              `${t('dashboard.calendarHeatmap.expense')}: ${formatCurrency(data.expenses, baseCurrency)}`,
            )
          const cellTitle = titleParts.join(' · ')

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedKey(isSelected ? null : dateKey)}
              disabled={!inRange}
              title={cellTitle || undefined}
              aria-label={`${format(day, 'MMMM d')}${cellTitle ? ': ' + cellTitle : ''}`}
              aria-pressed={isSelected}
              style={inlineStyle}
              className={[
                'aspect-square rounded-md flex flex-col items-center justify-center relative',
                'text-[10px] font-medium transition-all select-none',
                inRange
                  ? 'cursor-pointer hover:ring-1 hover:ring-indigo-300'
                  : 'opacity-25 cursor-default pointer-events-none',
                isSelected ? 'ring-2 ring-indigo-500' : '',
                !hasIncome && !hasExpense ? 'text-gray-300' : 'text-gray-700',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {String(day.getDate())}

              {/* Green dot below number = income on this day */}
              {hasIncome && inRange && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected-day detail panel */}
      {selectedKey && hasSelectedActivity && selectedData && (
        <div className="mt-3 pt-3 border-t text-xs space-y-1.5" data-testid="day-detail">
          <p className="font-semibold text-gray-600">
            {format(new Date(`${selectedKey}T12:00:00`), 'EEEE, MMMM d')}
          </p>

          {selectedData.income > 0 && (
            <div className="flex justify-between">
              <span className="text-green-600">{t('dashboard.calendarHeatmap.income')}</span>
              <span className="font-medium text-green-600">
                {formatCurrency(selectedData.income, baseCurrency)}
              </span>
            </div>
          )}

          {selectedData.expenses > 0 && (
            <div className="flex justify-between">
              <span className="text-red-500">{t('dashboard.calendarHeatmap.expense')}</span>
              <span className="font-medium text-red-500">
                {formatCurrency(selectedData.expenses, baseCurrency)}
              </span>
            </div>
          )}

          {selectedData.income > 0 && selectedData.expenses > 0 && (
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-gray-500">{t('dashboard.calendarHeatmap.net')}</span>
              <span
                className={`font-medium ${
                  selectedData.income - selectedData.expenses >= 0
                    ? 'text-indigo-600'
                    : 'text-orange-500'
                }`}
              >
                {formatCurrency(selectedData.income - selectedData.expenses, baseCurrency)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Empty state — no transactions in this month at all */}
      {!isSameMonth(from, to) &&
        days.every((day) => {
          const k = format(day, 'yyyy-MM-dd')
          const d = dayDataMap.get(k)
          return !d || (d.income === 0 && d.expenses === 0)
        }) && (
          <p className="text-xs text-center text-gray-400 mt-3">
            {t('dashboard.calendarHeatmap.noData')}
          </p>
        )}
    </div>
  )
}
