import { describe, it, expect } from 'vitest'

import {
  calcKmPerLiter,
  calcCostPerKm,
  calcKmSinceLastFill,
  getOdometerNeighbors,
  getServiceTypeLabel,
  SERVICE_TYPE_KEY_MAP,
} from '@/lib/vehicles'
import type { OdometerEntry } from '@/lib/vehicles'

// ─── calcKmPerLiter ───────────────────────────────────────────────────────────

describe('calcKmPerLiter', () => {
  it('calculates km/L for a normal fill-up', () => {
    expect(calcKmPerLiter(500, 50)).toBe(10)
  })

  it('rounds to 2 decimal places', () => {
    // 150 / 12 = 12.5
    expect(calcKmPerLiter(150, 12)).toBe(12.5)
    // 100 / 3 = 33.333... → 33.33
    expect(calcKmPerLiter(100, 3)).toBe(33.33)
  })

  it('returns 0 when liters is 0 (avoids division by zero)', () => {
    expect(calcKmPerLiter(100, 0)).toBe(0)
  })

  it('returns 0 when km traveled is 0', () => {
    expect(calcKmPerLiter(0, 40)).toBe(0)
  })

  it('handles very small fuel amounts', () => {
    expect(calcKmPerLiter(1, 0.5)).toBe(2)
  })
})

// ─── calcCostPerKm ────────────────────────────────────────────────────────────

describe('calcCostPerKm', () => {
  it('calculates cost per km in cents', () => {
    // $50 (5000 cents) for 100 km → 50 cents/km
    expect(calcCostPerKm(5000, 100)).toBe(50)
  })

  it('rounds to 2 decimal places', () => {
    // 10000 cents / 3 km = 3333.33...
    expect(calcCostPerKm(10000, 3)).toBe(3333.33)
  })

  it('returns 0 when km is 0 (avoids division by zero)', () => {
    expect(calcCostPerKm(5000, 0)).toBe(0)
  })

  it('returns 0 when total cost is 0', () => {
    expect(calcCostPerKm(0, 100)).toBe(0)
  })

  it('handles fractional result correctly', () => {
    // 1500 cents / 200 km = 7.5 cents/km
    expect(calcCostPerKm(1500, 200)).toBe(7.5)
  })
})

// ─── calcKmSinceLastFill ──────────────────────────────────────────────────────

describe('calcKmSinceLastFill', () => {
  it('calculates distance between two odometer readings', () => {
    expect(calcKmSinceLastFill(5400, 5000)).toBe(400)
  })

  it('returns 0 when odometer is the same (no movement)', () => {
    expect(calcKmSinceLastFill(5000, 5000)).toBe(0)
  })

  it('returns 0 when current is less than previous (data entry error)', () => {
    expect(calcKmSinceLastFill(4900, 5000)).toBe(0)
  })

  it('handles large distances', () => {
    expect(calcKmSinceLastFill(200000, 199500)).toBe(500)
  })
})

// ─── getOdometerNeighbors ─────────────────────────────────────────────────────

describe('getOdometerNeighbors', () => {
  const entries: OdometerEntry[] = [
    { date: '2025-01-10T12:00:00.000Z', odometer: 10000 },
    { date: '2025-02-10T12:00:00.000Z', odometer: 10500 },
    { date: '2025-03-10T12:00:00.000Z', odometer: 11000 },
  ]

  it('returns empty object when entries list is empty', () => {
    expect(getOdometerNeighbors([], '2025-02-15T12:00:00.000Z')).toEqual({})
  })

  it('returns empty object when selectedIso is undefined', () => {
    expect(getOdometerNeighbors(entries, undefined)).toEqual({})
  })

  it('returns only nextOdometer when date is before all entries', () => {
    const result = getOdometerNeighbors(entries, '2024-12-01T12:00:00.000Z')
    expect(result.previousOdometer).toBeUndefined()
    expect(result.nextOdometer).toBe(10000)
  })

  it('returns only previousOdometer when date is after all entries', () => {
    const result = getOdometerNeighbors(entries, '2025-04-01T12:00:00.000Z')
    expect(result.previousOdometer).toBe(11000)
    expect(result.nextOdometer).toBeUndefined()
  })

  it('returns both neighbors when date falls between two entries', () => {
    const result = getOdometerNeighbors(entries, '2025-02-15T12:00:00.000Z')
    expect(result.previousOdometer).toBe(10500)
    expect(result.nextOdometer).toBe(11000)
  })

  it('treats an exact date match as the previous odometer', () => {
    // date equal to an entry → that entry is treated as "previous"
    const result = getOdometerNeighbors(entries, '2025-02-10T12:00:00.000Z')
    expect(result.previousOdometer).toBe(10500)
    expect(result.nextOdometer).toBe(11000)
  })

  it('returns correct neighbors with a single entry', () => {
    const single: OdometerEntry[] = [{ date: '2025-06-01T12:00:00.000Z', odometer: 20000 }]

    const before = getOdometerNeighbors(single, '2025-05-01T12:00:00.000Z')
    expect(before.previousOdometer).toBeUndefined()
    expect(before.nextOdometer).toBe(20000)

    const after = getOdometerNeighbors(single, '2025-07-01T12:00:00.000Z')
    expect(after.previousOdometer).toBe(20000)
    expect(after.nextOdometer).toBeUndefined()
  })
})

// ─── getServiceTypeLabel ──────────────────────────────────────────────────────

describe('getServiceTypeLabel', () => {
  const t = (key: string) => {
    const translations: Record<string, string> = {
      'vehicles.serviceTypes.oilChange': 'Oil Change',
      'vehicles.serviceTypes.tireRotation': 'Tire Rotation',
      'vehicles.serviceTypes.brakePads': 'Brake Pads',
      'vehicles.serviceTypes.other': 'Other',
    }
    return translations[key] ?? key
  }

  it('returns translated label for a known service type', () => {
    expect(getServiceTypeLabel('Oil change', t)).toBe('Oil Change')
    expect(getServiceTypeLabel('Tire rotation', t)).toBe('Tire Rotation')
    expect(getServiceTypeLabel('Brake pads', t)).toBe('Brake Pads')
  })

  it('returns the raw service type string when not in the map (custom type)', () => {
    expect(getServiceTypeLabel('Custom engine tune', t)).toBe('Custom engine tune')
  })

  it('is case-sensitive — unrecognised casing falls through to raw string', () => {
    // Keys in SERVICE_TYPE_KEY_MAP are title-cased; wrong case → passthrough
    expect(getServiceTypeLabel('oil change', t)).toBe('oil change')
  })

  it('returns translated label for "Other"', () => {
    expect(getServiceTypeLabel('Other', t)).toBe('Other')
  })
})

// ─── SERVICE_TYPE_KEY_MAP ─────────────────────────────────────────────────────

describe('SERVICE_TYPE_KEY_MAP', () => {
  it('maps every key to a vehicles.serviceTypes.* i18n key', () => {
    for (const [serviceType, i18nKey] of Object.entries(SERVICE_TYPE_KEY_MAP)) {
      expect(i18nKey).toMatch(/^vehicles\.serviceTypes\./)
      expect(serviceType.length).toBeGreaterThan(0)
    }
  })

  it('contains the expected well-known service types', () => {
    const expected = ['Oil change', 'Tire rotation', 'Brake pads', 'Battery replacement', 'Other']
    for (const type of expected) {
      expect(SERVICE_TYPE_KEY_MAP).toHaveProperty(type)
    }
  })
})
