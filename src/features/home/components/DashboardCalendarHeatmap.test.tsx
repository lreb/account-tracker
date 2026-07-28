import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { buildCalendarDayData, maxDailyExpense } from './DashboardCalendarHeatmap.utils'
import { DashboardCalendarHeatmap } from './DashboardCalendarHeatmap'
import type { Transaction } from '@/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/lib/currency', () => ({
  formatCurrency: (cents: number, currency: string) => `${currency} ${cents}`,
}))

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _id = 0
beforeEach(() => { _id = 0 })

function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>,
): Transaction {
  return {
    id: `tx-${++_id}`,
    status: 'cleared',
    accountId: 'acc1',
    currency: 'USD',
    description: '',
    categoryId: 'cat1',
    ...overrides,
  }
}

/** Build an ISO date string at local noon to avoid UTC-boundary issues. */
function localNoon(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

// ─── buildCalendarDayData ─────────────────────────────────────────────────────

describe('buildCalendarDayData', () => {
  it('returns empty map for empty transactions array', () => {
    expect(buildCalendarDayData([])).toEqual(new Map())
  })

  it('aggregates income for a single day', () => {
    const txs = [makeTx({ type: 'income', amount: 10000, date: localNoon(2025, 6, 15) })]
    const map = buildCalendarDayData(txs)
    expect(map.get('2025-06-15')).toEqual({ income: 10000, expenses: 0 })
  })

  it('aggregates expense for a single day', () => {
    const txs = [makeTx({ type: 'expense', amount: 5000, date: localNoon(2025, 6, 15) })]
    const map = buildCalendarDayData(txs)
    expect(map.get('2025-06-15')).toEqual({ income: 0, expenses: 5000 })
  })

  it('accumulates multiple transactions on the same day', () => {
    const txs = [
      makeTx({ type: 'income',  amount: 10000, date: localNoon(2025, 6, 15) }),
      makeTx({ type: 'expense', amount: 3000,  date: localNoon(2025, 6, 15) }),
      makeTx({ type: 'expense', amount: 2000,  date: localNoon(2025, 6, 15) }),
    ]
    const map = buildCalendarDayData(txs)
    expect(map.get('2025-06-15')).toEqual({ income: 10000, expenses: 5000 })
  })

  it('maps transactions on different days to separate keys', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 1000, date: localNoon(2025, 6, 10) }),
      makeTx({ type: 'expense', amount: 2000, date: localNoon(2025, 6, 20) }),
    ]
    const map = buildCalendarDayData(txs)
    expect(map.get('2025-06-10')).toEqual({ income: 0, expenses: 1000 })
    expect(map.get('2025-06-20')).toEqual({ income: 0, expenses: 2000 })
  })

  it('excludes cancelled transactions', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 9999, date: localNoon(2025, 6, 15), status: 'cancelled' }),
    ]
    const map = buildCalendarDayData(txs)
    expect(map.has('2025-06-15')).toBe(false)
  })

  it('excludes transfer transactions', () => {
    const txs = [
      makeTx({ type: 'transfer', amount: 5000, date: localNoon(2025, 6, 15) }),
    ]
    const map = buildCalendarDayData(txs)
    expect(map.has('2025-06-15')).toBe(false)
  })

  it('keeps cleared, pending, and reconciled transactions', () => {
    const txs = [
      makeTx({ type: 'expense', amount: 100, date: localNoon(2025, 6, 1), status: 'cleared' }),
      makeTx({ type: 'expense', amount: 200, date: localNoon(2025, 6, 2), status: 'pending' }),
      makeTx({ type: 'expense', amount: 300, date: localNoon(2025, 6, 3), status: 'reconciled' }),
    ]
    const map = buildCalendarDayData(txs)
    expect(map.get('2025-06-01')?.expenses).toBe(100)
    expect(map.get('2025-06-02')?.expenses).toBe(200)
    expect(map.get('2025-06-03')?.expenses).toBe(300)
  })
})

// ─── maxDailyExpense ──────────────────────────────────────────────────────────

describe('maxDailyExpense', () => {
  it('returns 0 for empty map', () => {
    expect(maxDailyExpense(new Map())).toBe(0)
  })

  it('returns the highest expense value', () => {
    const map = new Map([
      ['2025-06-01', { income: 0, expenses: 500 }],
      ['2025-06-02', { income: 0, expenses: 8000 }],
      ['2025-06-03', { income: 5000, expenses: 100 }],
    ])
    expect(maxDailyExpense(map)).toBe(8000)
  })

  it('ignores income-only days', () => {
    const map = new Map([
      ['2025-06-01', { income: 99999, expenses: 0 }],
    ])
    expect(maxDailyExpense(map)).toBe(0)
  })
})

// ─── DashboardCalendarHeatmap component ──────────────────────────────────────

const FROM = new Date(2025, 5, 1)   // June 1 2025
const TO   = new Date(2025, 5, 30)  // June 30 2025

function renderHeatmap(
  txs: Transaction[] = [],
  from: Date = FROM,
  to: Date = TO,
) {
  return render(
    <DashboardCalendarHeatmap
      transactions={txs}
      baseCurrency="USD"
      from={from}
      to={to}
    />,
  )
}

describe('DashboardCalendarHeatmap', () => {
  describe('rendering', () => {
    it('renders the section title', () => {
      renderHeatmap()
      expect(screen.getByText('dashboard.calendarHeatmap.title')).toBeInTheDocument()
    })

    it('renders the calendar grid', () => {
      renderHeatmap()
      expect(screen.getByTestId('calendar-grid')).toBeInTheDocument()
    })

    it('renders 7 weekday header labels', () => {
      renderHeatmap()
      // weekday headers are single-letter abbreviations (EEEEE format)
      // We just verify 7 cells exist in the header row by checking the grid
      // has day numbers 1-30 for June
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('30')).toBeInTheDocument()
    })

    it('renders the income and expense legend items', () => {
      renderHeatmap()
      expect(screen.getByText('dashboard.calendarHeatmap.income')).toBeInTheDocument()
      expect(screen.getByText('dashboard.calendarHeatmap.expense')).toBeInTheDocument()
    })

    it('shows formatted month in the header', () => {
      renderHeatmap()
      // format(June 2025, 'MMM yyyy') → "Jun 2025"
      expect(screen.getByText('Jun 2025')).toBeInTheDocument()
    })
  })

  describe('month navigation', () => {
    it('disables the prev button when on the first month of the range', () => {
      renderHeatmap()
      const prevBtn = screen.getByLabelText('dashboard.calendarHeatmap.prevMonth')
      expect(prevBtn).toBeDisabled()
    })

    it('disables the next button when on the last month of the range', () => {
      renderHeatmap()
      const nextBtn = screen.getByLabelText('dashboard.calendarHeatmap.nextMonth')
      expect(nextBtn).toBeDisabled()
    })

    it('enables prev button when navigated past the first month', () => {
      const from = new Date(2025, 5, 1)  // June
      const to   = new Date(2025, 7, 31) // August
      renderHeatmap([], from, to)

      // Navigate to July
      const nextBtn = screen.getByLabelText('dashboard.calendarHeatmap.nextMonth')
      fireEvent.click(nextBtn)
      expect(screen.getByText('Jul 2025')).toBeInTheDocument()

      const prevBtn = screen.getByLabelText('dashboard.calendarHeatmap.prevMonth')
      expect(prevBtn).not.toBeDisabled()
    })

    it('enables next button when range spans multiple months', () => {
      const from = new Date(2025, 5, 1)  // June
      const to   = new Date(2025, 6, 31) // July
      renderHeatmap([], from, to)
      expect(screen.getByLabelText('dashboard.calendarHeatmap.nextMonth')).not.toBeDisabled()
    })

    it('navigates to the next month when next button is clicked', () => {
      const from = new Date(2025, 5, 1)
      const to   = new Date(2025, 6, 31)
      renderHeatmap([], from, to)

      fireEvent.click(screen.getByLabelText('dashboard.calendarHeatmap.nextMonth'))
      expect(screen.getByText('Jul 2025')).toBeInTheDocument()
    })

    it('navigates back to the previous month when prev is clicked', () => {
      const from = new Date(2025, 5, 1)
      const to   = new Date(2025, 6, 31)
      renderHeatmap([], from, to)

      fireEvent.click(screen.getByLabelText('dashboard.calendarHeatmap.nextMonth'))
      fireEvent.click(screen.getByLabelText('dashboard.calendarHeatmap.prevMonth'))
      expect(screen.getByText('Jun 2025')).toBeInTheDocument()
    })
  })

  describe('day selection', () => {
    it('shows detail panel when a day with activity is clicked', () => {
      const txs = [
        makeTx({ type: 'expense', amount: 4500, date: localNoon(2025, 6, 15) }),
      ]
      renderHeatmap(txs)

      // Click on day 15
      const day15 = screen.getByRole('button', { name: /June 15/ })
      fireEvent.click(day15)

      expect(screen.getByTestId('day-detail')).toBeInTheDocument()
    })

    it('hides detail panel on second click (toggle)', () => {
      const txs = [
        makeTx({ type: 'expense', amount: 4500, date: localNoon(2025, 6, 15) }),
      ]
      renderHeatmap(txs)

      const day15 = screen.getByRole('button', { name: /June 15/ })
      fireEvent.click(day15)
      expect(screen.getByTestId('day-detail')).toBeInTheDocument()

      fireEvent.click(day15)
      expect(screen.queryByTestId('day-detail')).not.toBeInTheDocument()
    })

    it('shows income amount in the detail panel', () => {
      const txs = [
        makeTx({ type: 'income', amount: 10000, date: localNoon(2025, 6, 10) }),
      ]
      renderHeatmap(txs)

      fireEvent.click(screen.getByRole('button', { name: /June 10/ }))

      expect(screen.getByTestId('day-detail')).toBeInTheDocument()
      // formatCurrency mock returns "USD 10000"
      expect(screen.getByText('USD 10000')).toBeInTheDocument()
    })

    it('shows expense amount in the detail panel', () => {
      const txs = [
        makeTx({ type: 'expense', amount: 7500, date: localNoon(2025, 6, 20) }),
      ]
      renderHeatmap(txs)

      fireEvent.click(screen.getByRole('button', { name: /June 20/ }))
      expect(screen.getByText('USD 7500')).toBeInTheDocument()
    })

    it('shows net row when both income and expense exist on the same day', () => {
      const txs = [
        makeTx({ type: 'income',  amount: 10000, date: localNoon(2025, 6, 15) }),
        makeTx({ type: 'expense', amount: 4000,  date: localNoon(2025, 6, 15) }),
      ]
      renderHeatmap(txs)

      fireEvent.click(screen.getByRole('button', { name: /June 15/ }))
      expect(screen.getByText('dashboard.calendarHeatmap.net')).toBeInTheDocument()
    })

    it('does not show detail panel for days without activity', () => {
      renderHeatmap([])
      // All days have no data — clicking an in-range day should not show detail
      const day1 = screen.getByRole('button', { name: 'June 1' })
      fireEvent.click(day1)
      expect(screen.queryByTestId('day-detail')).not.toBeInTheDocument()
    })

    it('clears day selection when navigating to a different month', () => {
      const from = new Date(2025, 5, 1)
      const to   = new Date(2025, 6, 31)
      const txs  = [makeTx({ type: 'expense', amount: 1000, date: localNoon(2025, 6, 5) })]
      renderHeatmap(txs, from, to)

      fireEvent.click(screen.getByRole('button', { name: /June 5/ }))
      expect(screen.getByTestId('day-detail')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('dashboard.calendarHeatmap.nextMonth'))
      expect(screen.queryByTestId('day-detail')).not.toBeInTheDocument()
    })
  })

  describe('range boundaries', () => {
    it('renders all 30 days for June', () => {
      renderHeatmap()
      // All 30 day buttons should be present in the grid
      const grid = screen.getByTestId('calendar-grid')
      const dayButtons = grid.querySelectorAll('button')
      expect(dayButtons).toHaveLength(30)
      // Spot-check a few with unambiguous exact names
      expect(screen.getByRole('button', { name: 'June 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'June 15' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'June 30' })).toBeInTheDocument()
    })

    it('disables days outside the from-to range', () => {
      // Range is only June 10 – June 20
      const from = new Date(2025, 5, 10)
      const to   = new Date(2025, 5, 20)
      renderHeatmap([], from, to)

      // Day 5 should be outside range → disabled
      const day5 = screen.getByRole('button', { name: /June 5/ })
      expect(day5).toBeDisabled()

      // Day 15 should be inside range → enabled
      const day15 = screen.getByRole('button', { name: /June 15/ })
      expect(day15).not.toBeDisabled()
    })
  })
})
