/**
 * Convert an amount in source currency to base currency cents.
 * @param amountCents  - integer cents in the source currency
 * @param exchangeRate - rate: 1 source unit = exchangeRate base units
 */
export function convertToBase(amountCents: number, exchangeRate: number): number {
  return Math.round(amountCents * exchangeRate)
}

/**
 * Format a cents value as a human-readable currency string.
 * @param cents    - integer cents
 * @param currency - ISO 4217 code (e.g. 'USD', 'MXN')
 * @param locale   - BCP 47 locale tag (defaults to 'en-US')
 */
export function formatCurrency(cents: number, currency: string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}
