import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import DashboardPage from './DashboardPage'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/stores/transactions.store', () => ({
  useTransactionsStore: () => ({
    transactions: [],
    loading: false,
    load: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/stores/accounts.store', () => ({
  useAccountsStore: () => ({ accounts: [] }),
}))

vi.mock('@/stores/budgets.store', () => ({
  useBudgetsStore: () => ({ budgets: [] }),
}))

vi.mock('@/stores/categories.store', () => ({
  useCategoriesStore: () => ({ categories: [] }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({ baseCurrency: 'USD' }),
}))

vi.mock('@/db', () => ({
  db: {
    transactions: {
      filter: () => ({ toArray: () => Promise.resolve([]) }),
    },
  },
}))

// Recharts uses ResizeObserver which is not available in jsdom
vi.mock('recharts', () => ({
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderDashboard() {
  return render(<DashboardPage />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', async () => {
    await renderDashboard()
    expect(document.body).toBeTruthy()
  })

  it('renders the page title', async () => {
    await renderDashboard()
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument()
  })

  it('renders the income summary label', async () => {
    await renderDashboard()
    expect(screen.getByText('dashboard.income')).toBeInTheDocument()
  })

  it('renders the expenses summary label', async () => {
    await renderDashboard()
    expect(screen.getByText('dashboard.expenses')).toBeInTheDocument()
  })

  it('renders the net period label', async () => {
    await renderDashboard()
    expect(screen.getByText('dashboard.netPeriod')).toBeInTheDocument()
  })

  it('renders the empty state message when there are no transactions', async () => {
    await renderDashboard()
    expect(screen.getByText('dashboard.noTransactions')).toBeInTheDocument()
  })

  it('renders the net worth card heading', async () => {
    await renderDashboard()
    expect(screen.getByText('dashboard.netWorth')).toBeInTheDocument()
  })
})
