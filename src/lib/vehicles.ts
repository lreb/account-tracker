// ─── Odometer context helpers ─────────────────────────────────────────────────

export type OdometerEntry = {
  date: string
  odometer: number
}

/**
 * Given a chronologically-sorted list of existing odometer readings and an ISO
 * date string for the entry being added/edited, returns the nearest previous and
 * next odometer values so the form can render a useful placeholder.
 */
export function getOdometerNeighbors(
  entries: OdometerEntry[],
  selectedIso?: string,
): { previousOdometer?: number; nextOdometer?: number } {
  if (!selectedIso || entries.length === 0) return {}

  let previousOdometer: number | undefined
  let nextOdometer: number | undefined

  for (const entry of entries) {
    if (entry.date <= selectedIso) {
      previousOdometer = entry.odometer
      continue
    }
    nextOdometer = entry.odometer
    break
  }

  return { previousOdometer, nextOdometer }
}

// ─── Service type label helpers ───────────────────────────────────────────────

export const SERVICE_TYPE_KEY_MAP: Record<string, string> = {
  'Oil change': 'vehicles.serviceTypes.oilChange',
  'Tire rotation': 'vehicles.serviceTypes.tireRotation',
  'Tire replacement': 'vehicles.serviceTypes.tireReplacement',
  'Brake pads': 'vehicles.serviceTypes.brakePads',
  'Brake discs': 'vehicles.serviceTypes.brakeDiscs',
  'Battery replacement': 'vehicles.serviceTypes.batteryReplacement',
  'Timing belt': 'vehicles.serviceTypes.timingBelt',
  'Spark plugs': 'vehicles.serviceTypes.sparkPlugs',
  'Air filter': 'vehicles.serviceTypes.airFilter',
  'Cabin filter': 'vehicles.serviceTypes.cabinFilter',
  'Fuel filter': 'vehicles.serviceTypes.fuelFilter',
  'Transmission fluid': 'vehicles.serviceTypes.transmissionFluid',
  'Coolant flush': 'vehicles.serviceTypes.coolantFlush',
  Alignment: 'vehicles.serviceTypes.alignment',
  Suspension: 'vehicles.serviceTypes.suspension',
  'AC service': 'vehicles.serviceTypes.acService',
  'General inspection': 'vehicles.serviceTypes.generalInspection',
  Other: 'vehicles.serviceTypes.other',
}

export function getServiceTypeLabel(serviceType: string, t: (key: string) => string): string {
  const key = SERVICE_TYPE_KEY_MAP[serviceType]
  return key ? t(key) : serviceType
}

// ─── Fuel efficiency calculations ─────────────────────────────────────────────

/** Calculate fuel efficiency in kilometers per liter. */
export function calcKmPerLiter(kmTraveled: number, liters: number): number {
  if (liters === 0) return 0
  return Math.round((kmTraveled / liters) * 100) / 100
}

/** Calculate cost per kilometer in cents/km. */
export function calcCostPerKm(totalCostCents: number, kmTraveled: number): number {
  if (kmTraveled === 0) return 0
  return Math.round((totalCostCents / kmTraveled) * 100) / 100
}

/** Calculate km driven since the last recorded odometer reading. */
export function calcKmSinceLastFill(currentOdometer: number, previousOdometer: number): number {
  return Math.max(0, currentOdometer - previousOdometer)
}
