import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardBudgetHealth } from './DashboardBudgetHealth'
import type { Budget } from '@/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    categoryId: 'food',
    amount: 10_000,
    period: 'monthly',
    rollover: false,
    startDate: '2025-01-01',
    currency: 'USD',
    ...overrides,
  }
}

describe('DashboardBudgetHealth', () => {
  it('renders category name for each budget row', () => {
    const rows = [
      { budget: makeBudget({ id: 'b1' }), spent: 5_000, percent: 50, catName: 'Food' },
    ]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(screen.getByText('Food')).toBeInTheDocument()
  })

  it('renders multiple budget rows', () => {
    const rows = [
      { budget: makeBudget({ id: 'b1' }), spent: 1_000, percent: 10, catName: 'Food' },
      { budget: makeBudget({ id: 'b2' }), spent: 7_500, percent: 80, catName: 'Transport' },
      { budget: makeBudget({ id: 'b3' }), spent: 10_000, percent: 100, catName: 'Housing' },
    ]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('Housing')).toBeInTheDocument()
  })

  it('shows green progress bar when percent < 75', () => {
    const rows = [{ budget: makeBudget(), spent: 5_000, percent: 50, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(document.querySelector('.bg-green-500')).toBeInTheDocument()
  })

  it('shows amber progress bar when percent is 75–99', () => {
    const rows = [{ budget: makeBudget(), spent: 7_500, percent: 75, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(document.querySelector('.bg-amber-400')).toBeInTheDocument()
  })

  it('shows red progress bar when percent >= 100', () => {
    const rows = [{ budget: makeBudget(), spent: 10_000, percent: 100, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(document.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('clamps progress bar width to 100% when over budget', () => {
    const rows = [{ budget: makeBudget(), spent: 15_000, percent: 150, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    const bar = document.querySelector('.bg-red-500') as HTMLElement
    expect(bar.style.width).toBe('100%')
  })

  it('displays percent value in the row header', () => {
    const rows = [{ budget: makeBudget(), spent: 7_500, percent: 75, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('applies red text class to percent label when >= 100', () => {
    const rows = [{ budget: makeBudget(), spent: 10_000, percent: 100, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(screen.getByText('100%')).toHaveClass('text-red-500')
  })

  it('applies amber text class to percent label when 75–99', () => {
    const rows = [{ budget: makeBudget(), spent: 9_000, percent: 90, catName: 'Food' }]
    render(<DashboardBudgetHealth topBudgets={rows} baseCurrency="USD" />)
    expect(screen.getByText('90%')).toHaveClass('text-amber-500')
  })

  it('renders an empty list without crashing', () => {
    const { container } = render(<DashboardBudgetHealth topBudgets={[]} baseCurrency="USD" />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders a link to /budgets', () => {
    render(<DashboardBudgetHealth topBudgets={[]} baseCurrency="USD" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/budgets')
  })
})
