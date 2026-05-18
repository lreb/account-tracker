import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

import { VehicleStats } from './VehicleStats'
import type { FuelLog, VehicleService } from '@/types'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('recharts', () => ({
  BarChart:          ({ children }: { children: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar:               () => null,
  XAxis:             () => null,
  YAxis:             () => null,
  Tooltip:           () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid:     () => null,
  PieChart:          ({ children }: { children: ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie:               () => null,
  Cell:              () => null,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip:         ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger:  ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent:  () => null,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet:        ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: () => null,
  SheetHeader:  () => null,
  SheetTitle:   () => null,
}))

vi.mock('@/lib/insights', () => ({
  getFuelEfficiencyTrend: vi.fn(),
}))

// ── Test helpers ──────────────────────────────────────────────────────────────

import { getFuelEfficiencyTrend } from '@/lib/insights'

let _logId = 0
let _svcId = 0

function makeLog(overrides: Partial<FuelLog> = {}): FuelLog {
  return {
    id: `log-${++_logId}`,
    vehicleId: 'v1',
    date: '2025-03-01T12:00:00.000Z',
    liters: 40,
    totalCost: 6000,   // $60.00
    odometer: 10000,
    ...overrides,
  }
}

function makeSvc(overrides: Partial<VehicleService> = {}): VehicleService {
  return {
    id: `svc-${++_svcId}`,
    vehicleId: 'v1',
    date: '2025-03-15T12:00:00.000Z',
    serviceType: 'Oil change',
    cost: 5000,        // $50.00
    odometer: 10000,
    ...overrides,
  }
}

const DEFAULT_PROPS = {
  logs: [] as FuelLog[],
  services: [] as VehicleService[],
  baseCurrency: 'USD',
  initialOdometer: 0,
} as const

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VehicleStats', () => {
  beforeEach(() => {
    _logId = 0
    _svcId = 0
    ;(getFuelEfficiencyTrend as Mock).mockReturnValue(null)
  })

  // ── Smoke ───────────────────────────────────────────────────────────────────

  it('renders without crashing with no data at all', () => {
    expect(() => render(<VehicleStats {...DEFAULT_PROPS} />)).not.toThrow()
  })

  it('renders the summary stat cards grid', () => {
    const { container } = render(<VehicleStats {...DEFAULT_PROPS} />)
    // Summary cards live in a 2-column grid; at least one card must be present
    expect(container.querySelector('.grid.grid-cols-2')).not.toBeNull()
  })

  // ── Fill-up count ───────────────────────────────────────────────────────────

  it('shows 0 fill-ups when there are no logs', () => {
    render(<VehicleStats {...DEFAULT_PROPS} />)
    // stats.fillUpCount is 0 → renders '0'
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThan(0)
  })

  it('shows the correct fill-up count with multiple logs', () => {
    const logs = [makeLog(), makeLog(), makeLog()]
    render(<VehicleStats {...DEFAULT_PROPS} logs={logs} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // ── Total liters ────────────────────────────────────────────────────────────

  it('shows "0.0 L" when there are no logs', () => {
    render(<VehicleStats {...DEFAULT_PROPS} />)
    expect(screen.getByText('0.0 L')).toBeInTheDocument()
  })

  it('shows the summed liters formatted to one decimal place', () => {
    const logs = [makeLog({ liters: 30 }), makeLog({ liters: 20.5 })]
    render(<VehicleStats {...DEFAULT_PROPS} logs={logs} />)
    expect(screen.getByText('50.5 L')).toBeInTheDocument()
  })

  it('rounds total liters to one decimal', () => {
    const logs = [makeLog({ liters: 10.33 }), makeLog({ liters: 10.33 })]
    render(<VehicleStats {...DEFAULT_PROPS} logs={logs} />)
    expect(screen.getByText('20.7 L')).toBeInTheDocument()
  })

  // ── Service count ───────────────────────────────────────────────────────────

  it('shows the total number of service records', () => {
    const services = [makeSvc(), makeSvc()]
    render(<VehicleStats {...DEFAULT_PROPS} services={services} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // ── Avg km/L ────────────────────────────────────────────────────────────────

  it('shows "—" for avg km/L when there is only one log (cannot compute a pair)', () => {
    render(<VehicleStats {...DEFAULT_PROPS} logs={[makeLog()]} />)
    // avgKmPerL === 0 → value rendered as '—'
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('shows computed km/L with two consecutive logs', () => {
    // 500 km driven on 50 L → 10.0 km/L
    const logs = [
      makeLog({ odometer: 10000, liters: 50, date: '2025-02-01T12:00:00.000Z' }),
      makeLog({ odometer: 10500, liters: 50, date: '2025-03-01T12:00:00.000Z' }),
    ]
    render(<VehicleStats {...DEFAULT_PROPS} logs={logs} />)
    expect(screen.getByText('10.0 km/L')).toBeInTheDocument()
  })

  // ── Fleet override: avg km/L ────────────────────────────────────────────────

  it('uses overrideAvgKmPerL when provided, ignoring computed value', () => {
    render(<VehicleStats {...DEFAULT_PROPS} overrideAvgKmPerL={15.3} />)
    expect(screen.getByText('15.3 km/L')).toBeInTheDocument()
  })

  it('shows "—" for avg km/L when overrideAvgKmPerL is 0', () => {
    render(<VehicleStats {...DEFAULT_PROPS} overrideAvgKmPerL={0} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  // ── Fleet override: total distance ──────────────────────────────────────────

  it('uses overrideTotalDistance when provided', () => {
    render(<VehicleStats {...DEFAULT_PROPS} overrideTotalDistance={500} />)
    expect(screen.getByText('500 km')).toBeInTheDocument()
  })

  it('shows "—" for total distance with no logs and no initial odometer', () => {
    render(<VehicleStats {...DEFAULT_PROPS} />)
    // displayTotalDistance === 0 → '—'
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('computes total distance using initialOdometer when provided', () => {
    const logs = [
      makeLog({ odometer: 10500 }),
      makeLog({ odometer: 11000 }),
    ]
    // totalDistance = 11000 - 10000 = 1000 km
    render(<VehicleStats {...DEFAULT_PROPS} logs={logs} initialOdometer={10000} />)
    expect(screen.getByText('1,000 km')).toBeInTheDocument()
  })

  // ── Fuel efficiency degradation alert ───────────────────────────────────────

  it('shows the efficiency alert banner when the trend is degrading', () => {
    ;(getFuelEfficiencyTrend as Mock).mockReturnValue({
      isDegrading: true,
      degradationPercent: 12.5,
      recentKmPerL: 8.5,
      baselineKmPerL: 10.0,
      windowSize: 5,
    })
    render(<VehicleStats {...DEFAULT_PROPS} />)
    expect(screen.getByText('vehicles.stats.efficiencyAlertTitle')).toBeInTheDocument()
  })

  it('does not show the efficiency alert when getFuelEfficiencyTrend returns null', () => {
    ;(getFuelEfficiencyTrend as Mock).mockReturnValue(null)
    render(<VehicleStats {...DEFAULT_PROPS} />)
    expect(screen.queryByText('vehicles.stats.efficiencyAlertTitle')).toBeNull()
  })

  it('does not show the efficiency alert when isDegrading is false', () => {
    ;(getFuelEfficiencyTrend as Mock).mockReturnValue({
      isDegrading: false,
      degradationPercent: 2,
      recentKmPerL: 9.8,
      baselineKmPerL: 10.0,
      windowSize: 5,
    })
    render(<VehicleStats {...DEFAULT_PROPS} />)
    expect(screen.queryByText('vehicles.stats.efficiencyAlertTitle')).toBeNull()
  })
})
