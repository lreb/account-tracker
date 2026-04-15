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
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { computeCategoryBreakdown } from '@/lib/reports'
import type { ReportFilters } from '@/lib/reports'
import { formatCurrency } from '@/lib/currency'
import { CategoryIcon } from '@/lib/icon-map'
import type { Transaction, Category, Account } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

type PresetKey = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

const PRESET_KEYS: PresetKey[] = ['thisWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom']

const PRESET_I18N_KEY: Record<PresetKey, string> = {
  thisWeek:  'reports.presets.thisWeek',
  thisMonth: 'reports.presets.thisMonth',
  lastMonth: 'reports.presets.lastMonth',
  thisYear:  'reports.presets.thisYear',
  custom:    'reports.presets.custom',
}

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
    case 'custom':
      return { from: startOfMonth(today), to: endOfMonth(today) }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface IncomesByCategoryReportProps {
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  baseCurrency: string
  visibleAccountIds: Set<string>
}

export function CategoryIncomesByCategoryReport({
  transactions,
  categories,
  accounts,
  baseCurrency,
  visibleAccountIds,
}: IncomesByCategoryReportProps) {
  const { t } = useTranslation()

  const [preset, setPreset] = useState<PresetKey>('thisMonth')
  const [customFrom, setCustomFrom] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  )
  const [customTo, setCustomTo] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  )
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const filters: ReportFilters = useMemo(() => {
    const base = preset === 'custom'
      ? { from: new Date(customFrom), to: new Date(customTo) }
      : getPresetRange(preset)
    return {
      ...base,
      accountId: filterAccount === 'all' ? undefined : filterAccount,
    }
  }, [preset, customFrom, customTo, filterAccount])

  const selectedAccountName = useMemo(() => {
    if (filterAccount === 'all') return t('reports.allAccounts')
    return accounts.find((a) => a.id === filterAccount)?.name ?? t('reports.allAccounts')
  }, [filterAccount, accounts, t])

  const slices = useMemo(
    () =>
      computeCategoryBreakdown(
        transactions,
        categories,
        filters,
        'income',
        visibleAccountIds,
      ),
    [transactions, categories, filters, visibleAccountIds],
  )

  const totalAmount = useMemo(
    () => slices.reduce((sum, s) => sum + s.amount, 0),
    [slices],
  )

  function handleListClick(index: number) {
    setActiveIndex((prev) => (prev === index ? null : index))
  }

  function handlePieClick(_data: unknown, index: number) {
    setActiveIndex((prev) => (prev === index ? null : index))
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
      {/* Title */}
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        {t('reports.incomeByCategory')}
      </h2>

      {/* Period filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {PRESET_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setPreset(k)
              setActiveIndex(null)
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              preset === k
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
            }`}
          >
            {t(PRESET_I18N_KEY[k])}
          </button>
        ))}
      </div>

      {/* Account filter */}
      <Select
        value={filterAccount}
        onValueChange={(value) => {
          setFilterAccount(value ?? 'all')
          setActiveIndex(null)
        }}
      >
        <SelectTrigger className="h-8 text-xs w-48">
          <span className="truncate">{selectedAccountName}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('reports.allAccounts')}</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom date range inputs */}
      {preset === 'custom' && (
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">{t('reports.from')}</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value)
                setActiveIndex(null)
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('reports.to')}</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value)
                setActiveIndex(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {slices.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">
          {t('reports.noData')}
        </div>
      ) : (
        <>
          {/* Pie chart */}
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                onClick={handlePieClick}
                style={{ cursor: 'pointer' }}
                labelLine={false}
              >
                {slices.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.3}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  typeof value === 'number' ? formatCurrency(value, baseCurrency) : ''
                }
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Category list */}
          <ul className="space-y-1">
            {slices.map((slice, i) => {
              const isActive = activeIndex === i
              return (
                <li
                  key={slice.categoryId}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleListClick(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleListClick(i)
                    }
                  }}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-xl cursor-pointer select-none transition-colors ${
                    isActive
                      ? 'bg-green-50 ring-1 ring-green-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <CategoryIcon
                    name={slice.icon}
                    size={14}
                    className="text-gray-500 shrink-0"
                  />
                  <span
                    className={`flex-1 text-sm truncate ${
                      isActive ? 'font-semibold text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    {slice.name}
                  </span>
                  <span className="text-xs text-gray-400">{slice.percent}%</span>
                  <span
                    className={`text-sm font-medium ${isActive ? 'text-green-600' : ''}`}
                  >
                    {formatCurrency(slice.amount, baseCurrency)}
                  </span>
                </li>
              )
            })}

            {/* Total row */}
            <li className="flex items-center gap-3 px-2 py-2 mt-1 border-t border-gray-200">
              <span className="w-3 h-3 shrink-0" />
              <span className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-sm font-semibold text-gray-700">
                {t('reports.total')}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(totalAmount, baseCurrency)}
              </span>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
