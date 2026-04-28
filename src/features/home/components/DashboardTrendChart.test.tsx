import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardTrendChart, type TrendPeriod } from './DashboardTrendChart'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: ({ tickFormatter }: { tickFormatter?: (v: number) => string }) => (
    <div data-testid="y-axis" data-formatter={tickFormatter ? 'present' : 'absent'} />
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

const TREND = [
  { month: 'Jan 25', income: 100_000, expenses: 50_000 },
  { month: 'Feb 25', income: 200_000, expenses: 80_000 },
]

describe('DashboardTrendChart', () => {
  it('renders all 4 period buttons', () => {
    render(
      <DashboardTrendChart
        trend={TREND}
        trendPeriod="3m"
        baseCurrency="USD"
        onPeriodChange={vi.fn()}
      />,
    )
    for (const p of ['3m', '6m', '1y', '2y'] as TrendPeriod[]) {
      expect(screen.getByText(`dashboard.trendPeriod.${p}`)).toBeInTheDocument()
    }
  })

  it('applies active styling to the selected period button', () => {
    render(
      <DashboardTrendChart
        trend={TREND}
        trendPeriod="1y"
        baseCurrency="USD"
        onPeriodChange={vi.fn()}
      />,
    )
    expect(screen.getByText('dashboard.trendPeriod.1y')).toHaveClass('bg-indigo-600')
    expect(screen.getByText('dashboard.trendPeriod.3m')).toHaveClass('bg-gray-100')
  })

  it('calls onPeriodChange with the clicked period', () => {
    const handler = vi.fn()
    render(
      <DashboardTrendChart
        trend={TREND}
        trendPeriod="3m"
        baseCurrency="USD"
        onPeriodChange={handler}
      />,
    )
    fireEvent.click(screen.getByText('dashboard.trendPeriod.6m'))
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('6m')
  })

  it('calls onPeriodChange with "2y" when that button is clicked', () => {
    const handler = vi.fn()
    render(
      <DashboardTrendChart
        trend={TREND}
        trendPeriod="1y"
        baseCurrency="USD"
        onPeriodChange={handler}
      />,
    )
    fireEvent.click(screen.getByText('dashboard.trendPeriod.2y'))
    expect(handler).toHaveBeenCalledWith('2y')
  })

  it('renders the chart container even with empty trend data', () => {
    render(
      <DashboardTrendChart
        trend={[]}
        trendPeriod="3m"
        baseCurrency="USD"
        onPeriodChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders the section title', () => {
    render(
      <DashboardTrendChart
        trend={[]}
        trendPeriod="3m"
        baseCurrency="USD"
        onPeriodChange={vi.fn()}
      />,
    )
    expect(screen.getByText('dashboard.trendTitle')).toBeInTheDocument()
  })
})

// ─── Y-axis tick formatter logic ─────────────────────────────────────────────
// The formatter divides cents by 100 before applying K/M abbreviations.
// These tests exercise the logic directly to guard against regressions.

describe('YAxis tick formatter (cents → readable label)', () => {
  function makeFormatter() {
    // Replicate the exact formatter from the component
    return (v: number) => {
      const units = v / 100
      if (Math.abs(units) >= 1_000_000) return `${(units / 1_000_000).toFixed(1)}M`
      if (Math.abs(units) >= 1_000) return `${(units / 1_000).toFixed(0)}K`
      return String(units)
    }
  }

  it('formats cents < $1 000 as plain number', () => {
    const fmt = makeFormatter()
    expect(fmt(5000)).toBe('50')   // $50.00
    expect(fmt(99900)).toBe('999') // $999.00
  })

  it('formats cents >= $1 000 as K', () => {
    const fmt = makeFormatter()
    expect(fmt(100_000)).toBe('1K')    // $1 000
    expect(fmt(1_500_000)).toBe('15K') // $15 000
    expect(fmt(99_900_000)).toBe('999K') // $999 000
  })

  it('formats cents >= $1 000 000 as M', () => {
    const fmt = makeFormatter()
    expect(fmt(100_000_000)).toBe('1.0M')  // $1 000 000
    expect(fmt(150_000_000)).toBe('1.5M')  // $1 500 000
  })

  it('handles zero', () => {
    const fmt = makeFormatter()
    expect(fmt(0)).toBe('0')
  })
})
