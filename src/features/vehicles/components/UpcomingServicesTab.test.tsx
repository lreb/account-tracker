import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import UpcomingServicesTab from './UpcomingServicesTab'
import type { UpcomingServiceItem } from './upcoming-services-tab.types'
import type { VehicleService } from '@/types'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// ── Test helpers ──────────────────────────────────────────────────────────────

let _id = 0

function makeSvc(overrides: Partial<VehicleService> = {}): VehicleService {
  return {
    id: `svc-${++_id}`,
    vehicleId: 'v1',
    date: '2025-01-01T12:00:00.000Z',
    serviceType: 'Service Alpha',
    cost: 5000,
    odometer: 10000,
    ...overrides,
  }
}

function makeItem(
  urgency: UpcomingServiceItem['urgency'],
  overrides: {
    kmRemaining?: number | null
    dueDate?: Date | null
    svc?: Partial<VehicleService>
  } = {},
): UpcomingServiceItem {
  return {
    svc: makeSvc(overrides.svc),
    urgency,
    kmRemaining: overrides.kmRemaining ?? null,
    dueDate: overrides.dueDate ?? null,
  }
}

function renderTab(items: UpcomingServiceItem[], vehicleId = 'v1') {
  return render(
    <MemoryRouter>
      <UpcomingServicesTab upcomingServices={items} vehicleId={vehicleId} />
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UpcomingServicesTab', () => {
  beforeEach(() => {
    _id = 0
  })

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('renders the empty-state message when there are no services', () => {
    renderTab([])
    expect(screen.getByText('vehicles.noUpcoming')).toBeInTheDocument()
  })

  it('does not render the list container when there are no services', () => {
    const { container } = renderTab([])
    expect(container.querySelector('div.space-y-2')).toBeNull()
  })

  // ── Urgency badge labels ────────────────────────────────────────────────────

  it('shows the overdue badge label for an overdue item', () => {
    renderTab([makeItem('overdue')])
    expect(screen.getByText('vehicles.stats.overdue')).toBeInTheDocument()
  })

  it('shows the dueSoon badge label for a soon item', () => {
    renderTab([makeItem('soon')])
    expect(screen.getByText('vehicles.stats.dueSoon')).toBeInTheDocument()
  })

  it('shows the upcomingLabel badge for an upcoming item', () => {
    renderTab([makeItem('upcoming')])
    expect(screen.getByText('vehicles.stats.upcomingLabel')).toBeInTheDocument()
  })

  // ── Urgency CSS classes ─────────────────────────────────────────────────────

  it('applies red background class to overdue items', () => {
    const { container } = renderTab([makeItem('overdue')])
    expect(container.querySelector('.bg-red-50')).not.toBeNull()
  })

  it('applies amber background class to soon items', () => {
    const { container } = renderTab([makeItem('soon')])
    expect(container.querySelector('.bg-amber-50')).not.toBeNull()
  })

  it('applies green background class to upcoming items', () => {
    const { container } = renderTab([makeItem('upcoming')])
    expect(container.querySelector('.bg-emerald-50')).not.toBeNull()
  })

  // ── Sort: urgency order ─────────────────────────────────────────────────────

  it('renders overdue before soon before upcoming regardless of input order', () => {
    const items = [
      makeItem('upcoming', { svc: { serviceType: 'Service Upcoming' } }),
      makeItem('overdue',  { svc: { serviceType: 'Service Overdue'  } }),
      makeItem('soon',     { svc: { serviceType: 'Service Soon'     } }),
    ]
    const { container } = renderTab(items)
    const badges = container.querySelectorAll('span.rounded-full')
    expect(badges[0]).toHaveTextContent('vehicles.stats.overdue')
    expect(badges[1]).toHaveTextContent('vehicles.stats.dueSoon')
    expect(badges[2]).toHaveTextContent('vehicles.stats.upcomingLabel')
  })

  it('renders all three items when mixed urgencies are provided', () => {
    const items = [makeItem('overdue'), makeItem('soon'), makeItem('upcoming')]
    const { container } = renderTab(items)
    expect(container.querySelectorAll('span.rounded-full')).toHaveLength(3)
  })

  // ── Sort: km proximity within same urgency ──────────────────────────────────

  it('sorts by kmRemaining ascending within the same urgency band', () => {
    const items = [
      makeItem('soon', { kmRemaining: 400, svc: { serviceType: 'Service Far'   } }),
      makeItem('soon', { kmRemaining: 100, svc: { serviceType: 'Service Close' } }),
      makeItem('soon', { kmRemaining: 250, svc: { serviceType: 'Service Mid'   } }),
    ]
    const { container } = renderTab(items)
    // Custom service type names pass through getServiceTypeLabel unchanged (not in map)
    const labels = container.querySelectorAll('p.text-sm.font-medium')
    expect(labels[0]).toHaveTextContent('Service Close')
    expect(labels[1]).toHaveTextContent('Service Mid')
    expect(labels[2]).toHaveTextContent('Service Far')
  })

  it('places items with null kmRemaining (Infinity) after items with finite km', () => {
    const items = [
      makeItem('upcoming', { kmRemaining: null, svc: { serviceType: 'Service NoKm'  } }),
      makeItem('upcoming', { kmRemaining: 200,  svc: { serviceType: 'Service HasKm' } }),
    ]
    const { container } = renderTab(items)
    const labels = container.querySelectorAll('p.text-sm.font-medium')
    expect(labels[0]).toHaveTextContent('Service HasKm')
    expect(labels[1]).toHaveTextContent('Service NoKm')
  })

  // ── Sort: due date tiebreak ─────────────────────────────────────────────────

  it('tiebreaks by dueDate ascending when kmRemaining is equal (both null)', () => {
    const sooner = new Date('2025-02-01')
    const later  = new Date('2025-04-01')
    const items = [
      makeItem('upcoming', { dueDate: later,  svc: { serviceType: 'Service Later'  } }),
      makeItem('upcoming', { dueDate: sooner, svc: { serviceType: 'Service Sooner' } }),
    ]
    const { container } = renderTab(items)
    const labels = container.querySelectorAll('p.text-sm.font-medium')
    expect(labels[0]).toHaveTextContent('Service Sooner')
    expect(labels[1]).toHaveTextContent('Service Later')
  })

  it('places item with null dueDate (Infinity) after item with a real date', () => {
    const items = [
      makeItem('upcoming', { dueDate: null,              svc: { serviceType: 'Service NoDate'  } }),
      makeItem('upcoming', { dueDate: new Date('2025-03-01'), svc: { serviceType: 'Service HasDate' } }),
    ]
    const { container } = renderTab(items)
    const labels = container.querySelectorAll('p.text-sm.font-medium')
    expect(labels[0]).toHaveTextContent('Service HasDate')
    expect(labels[1]).toHaveTextContent('Service NoDate')
  })

  // ── Km due display ──────────────────────────────────────────────────────────

  it('shows km-left text when kmRemaining > 0 and svc.nextServiceKm is set', () => {
    const item = makeItem('soon', {
      kmRemaining: 300,
      svc: { nextServiceKm: 15300, serviceType: 'Service Alpha' },
    })
    renderTab([item])
    expect(screen.getByText('(vehicles.stats.kmLeft)')).toBeInTheDocument()
  })

  it('shows overdue-by-km text when kmRemaining <= 0 and svc.nextServiceKm is set', () => {
    const item = makeItem('overdue', {
      kmRemaining: -50,
      svc: { nextServiceKm: 14950, serviceType: 'Service Alpha' },
    })
    renderTab([item])
    expect(screen.getByText('(vehicles.stats.overdueByKm)')).toBeInTheDocument()
  })

  it('shows the dueAt i18n key when svc.nextServiceKm is set', () => {
    const item = makeItem('soon', {
      kmRemaining: 200,
      svc: { nextServiceKm: 15200, serviceType: 'Service Alpha' },
    })
    const { container } = renderTab([item])
    // The dueAt key is a text node inside the <p>; check the p's text content
    const kmParagraphs = container.querySelectorAll('p.text-xs')
    const dueAtRow = Array.from(kmParagraphs).find((p) =>
      p.textContent?.includes('vehicles.stats.dueAt'),
    )
    expect(dueAtRow).toBeDefined()
  })

  it('does not show the km row when svc.nextServiceKm is not set', () => {
    const item = makeItem('upcoming', {
      kmRemaining: null,
      svc: { serviceType: 'Service Alpha' },  // nextServiceKm undefined
    })
    renderTab([item])
    expect(screen.queryByText(/vehicles\.stats\.dueAt/)).toBeNull()
  })

  // ── Due date display ────────────────────────────────────────────────────────

  it('shows due-date row when dueDate is set', () => {
    const item: UpcomingServiceItem = {
      svc: makeSvc(),
      urgency: 'upcoming',
      kmRemaining: null,
      dueDate: new Date('2025-06-15'),
    }
    renderTab([item])
    expect(screen.getByText('vehicles.stats.dueOn')).toBeInTheDocument()
  })

  it('does not show the due-date row when dueDate is null', () => {
    const item = makeItem('upcoming', { dueDate: null })
    renderTab([item])
    expect(screen.queryByText('vehicles.stats.dueOn')).toBeNull()
  })

  // ── Notes ───────────────────────────────────────────────────────────────────

  it('renders service notes when the svc has notes', () => {
    const item = makeItem('upcoming', { svc: { notes: 'Check coolant level too' } })
    renderTab([item])
    expect(screen.getByText('Check coolant level too')).toBeInTheDocument()
  })

  it('does not render a notes paragraph when notes are absent', () => {
    const item = makeItem('upcoming', { svc: { notes: undefined } })
    renderTab([item])
    expect(screen.queryByText('Check coolant level too')).toBeNull()
  })

  // ── Edit button ─────────────────────────────────────────────────────────────

  it('renders one edit button per service item', () => {
    renderTab([makeItem('overdue'), makeItem('soon'), makeItem('upcoming')])
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('edit button is interactive and navigates without throwing', async () => {
    const user = userEvent.setup()
    const item = makeItem('overdue', { svc: { id: 'svc-nav-1' } })
    renderTab([item], 'vehicle-42')
    // Clicking the edit button calls navigate('/vehicles/vehicle-42/service/svc-nav-1')
    // MemoryRouter handles it; the test verifies no crash and an interactive button.
    await user.click(screen.getByRole('button'))
  })
})
