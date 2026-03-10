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
