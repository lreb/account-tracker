import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format,
} from 'date-fns'

import { computeLabelBreakdown, type ReportFilters } from '@/lib/reports'
import { formatCurrency } from '@/lib/currency'
import type { Transaction, Label } from '@/types'

import { Input } from '@/components/ui/input'
import { Label as UILabel } from '@/components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

type PresetKey = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

const PRESET_KEYS: PresetKey[] = ['thisWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom']

function getPresetRange(key: PresetKey): { from: Date; to: Date } {
  const today = new Date()
  switch (key) {
    case 'thisWeek':
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
      }
    case 'thisMonth':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'lastMonth': {
      const lm = subMonths(today, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm) }
    }
    case 'thisYear':
      return { from: startOfYear(today), to: endOfYear(today) }
    default:
      return { from: startOfMonth(today), to: endOfMonth(today) }
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LabelReportProps {
  transactions: Transaction[]
  labels: Label[]
  visibleAccountIds: Set<string>
  baseCurrency: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LabelReport({
  transactions,
  labels,
  visibleAccountIds,
  baseCurrency,
}: LabelReportProps) {
  const { t } = useTranslation()

  const [preset, setPreset] = useState<PresetKey>('thisMonth')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]) // empty = all

  const filters: ReportFilters = useMemo(() => {
    if (preset === 'custom') {
      return { from: new Date(customFrom), to: new Date(customTo) }
    }
    return getPresetRange(preset)
  }, [preset, customFrom, customTo])

  // Full breakdown (computeLabelBreakdown already sorts descending by expenses)
  const untaggedLabel = t('reports.untagged')
  const breakdown = useMemo(
    () => computeLabelBreakdown(transactions, labels, filters, visibleAccountIds, untaggedLabel),
    [transactions, labels, filters, visibleAccountIds, untaggedLabel],
  )

  // Apply label chip filter — only expense-bearing slices, re-sorted descending
  const displayed = useMemo(() => {
    const base = selectedLabelIds.length === 0
      ? breakdown
      : breakdown.filter((s) => selectedLabelIds.includes(s.labelId))
    return [...base].sort((a, b) => b.expenses - a.expenses)
  }, [breakdown, selectedLabelIds])

  const totalExpenses = useMemo(
    () => displayed.reduce((sum, s) => sum + s.expenses, 0),
    [displayed],
  )

  const toggleLabel = (id: string) =>
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          {t('reports.labelExpenses')}
        </h2>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-3 border-b bg-gray-50">

        {/* Period presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                preset === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t(`reports.presets.${key}`)}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {preset === 'custom' && (
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <UILabel className="text-xs">{t('reports.from')}</UILabel>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="flex-1 space-y-1">
              <UILabel className="text-xs">{t('reports.to')}</UILabel>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>
        )}

        {/* Label filter chips */}
        {labels.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">{t('reports.filterByLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedLabelIds([])}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selectedLabelIds.length === 0
                    ? 'bg-gray-700 text-white border-gray-700'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('reports.allLabels')}
              </button>
              {labels.map((lbl) => {
                const active = selectedLabelIds.includes(lbl.id)
                return (
                  <button
                    key={lbl.id}
                    type="button"
                    onClick={() => toggleLabel(lbl.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      active ? 'text-white border-transparent' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                    style={active ? { background: lbl.color ?? '#6366f1', borderColor: lbl.color ?? '#6366f1' } : undefined}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: lbl.color ?? '#6366f1' }}
                    />
                    {lbl.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">
          {t('reports.noLabelExpenses')}
        </div>
      ) : (
        <ul className="divide-y">
          {displayed.map((slice) => {
            const pct = totalExpenses > 0 ? Math.round((slice.expenses / totalExpenses) * 100) : 0
            return (
              <li key={slice.labelId} className="px-4 py-3 space-y-2">
                {/* Label row */}
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: slice.color }}
                  />
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                    {slice.name} 
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {slice.txCount === 1
                      ? t('reports.txCount', { count: slice.txCount })
                      : t('reports.txCountPlural', { count: slice.txCount })}
                  </span>
                  <span className="text-sm font-bold text-red-500 shrink-0 ml-2">
                    {formatCurrency(slice.expenses, baseCurrency)}
                  </span>
                </div>

                {/* Share bar */}
                {slice.expenses > 0 && (
                  <div className="space-y-0.5">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: slice.color }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 text-right">
                      {pct}% {t('reports.shareOfTotalExpenses')}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Total footer ─────────────────────────────────────────────────── */}
      {displayed.length > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {t('reports.expenses')}
          </span>
          <span className="text-sm font-bold text-red-500">
            {formatCurrency(totalExpenses, baseCurrency)}
          </span>
        </div>
      )}
    </div>
  )
}
