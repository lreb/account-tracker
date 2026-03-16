/**
 * Convert an amount in source currency to base currency cents.
 * @param amountCents  - integer cents in the source currency
 * @param exchangeRate - rate: 1 source unit = exchangeRate base units
 */
export function convertToBase(amountCents: number, exchangeRate: number): number {
  return Math.round(amountCents * exchangeRate)
}

// Option E: cache Intl.NumberFormat instances — constructing them is expensive
// when called hundreds of times per render (one per transaction row).
const _fmtCache = new Map<string, Intl.NumberFormat>()

/**
 * Format a cents value as a human-readable currency string.
 * @param cents    - integer cents
 * @param currency - ISO 4217 code (e.g. 'USD', 'MXN')
 * @param locale   - BCP 47 locale tag (defaults to 'en-US')
 */
export function formatCurrency(cents: number, currency: string, locale = 'en-US'): string {
  const key = `${locale}-${currency}`
  let fmt = _fmtCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 })
    _fmtCache.set(key, fmt)
  }
  return fmt.format(cents / 100)
}
