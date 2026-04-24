// ─── Types ────────────────────────────────────────────────────────────────────

export type CompoundingFrequency =
  | 'annual'
  | 'semiannual'
  | 'quarterly'
  | 'monthly'
  | 'daily'
  | 'continuous'

export type ContributionFrequency = 'monthly' | 'annual'

export type TimeUnit = 'years' | 'months'

export interface CompoundInterestInputs {
  principal: number              // direct amount (not cents)
  annualRate: number             // percentage, e.g. 7 for 7%
  time: number                   // in timeUnit
  timeUnit: TimeUnit
  compoundingFreq: CompoundingFrequency
  contributionAmount: number     // periodic deposit
  contributionFreq: ContributionFrequency
  contributionGrowthRate: number // % per year increase on contributions
  withdrawalAmount: number       // periodic withdrawal
  withdrawalFreq: ContributionFrequency
  inflationRate: number          // % per year
}

export interface PeriodRow {
  period: number        // 1-based year
  openingBalance: number
  interest: number
  contributions: number
  withdrawals: number
  closingBalance: number
  realValue: number
}

export interface CompoundInterestResults {
  futureValue: number
  totalInterest: number
  totalContributions: number
  totalWithdrawals: number
  effectiveAnnualRate: number   // decimal, e.g. 0.07 for 7%
  doubleTime: number | null     // years (Rule of 72)
  realValue: number             // inflation-adjusted future value
  simpleInterestFV: number      // principal-only simple interest for comparison
  breakdown: PeriodRow[]
}

export interface ChartDataPoint {
  year: number
  totalValue: number            // full simulation (with contributions)
  investedCapital: number       // principal + cumulative contributions (no interest)
  compoundOnly: number          // analytical compound (principal only)
  simpleOnly: number            // analytical simple (principal only)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const N_MAP: Record<Exclude<CompoundingFrequency, 'continuous'>, number> = {
  annual: 1,
  semiannual: 2,
  quarterly: 4,
  monthly: 12,
  daily: 365,
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Simulate compound interest month-by-month.
 *
 * Convention: contributions are deposited at the **beginning** of each period
 * (annuity-due), withdrawals are taken at the **end** of each period.
 * Interest is applied at the end of each compounding period.
 */
export function calculateCompoundInterest(
  inputs: CompoundInterestInputs,
): CompoundInterestResults {
  const {
    principal,
    annualRate,
    time,
    timeUnit,
    compoundingFreq,
    contributionAmount,
    contributionFreq,
    contributionGrowthRate,
    withdrawalAmount,
    withdrawalFreq,
    inflationRate,
  } = inputs

  // Guard against degenerate inputs
  if (time <= 0 || principal < 0 || annualRate < 0) {
    return {
      futureValue: Math.max(0, principal),
      totalInterest: 0,
      totalContributions: 0,
      totalWithdrawals: 0,
      effectiveAnnualRate: 0,
      doubleTime: null,
      realValue: Math.max(0, principal),
      simpleInterestFV: Math.max(0, principal),
      breakdown: [],
    }
  }

  const r      = annualRate / 100
  const inflR  = inflationRate / 100
  const totalMonths = Math.max(1, Math.round(timeUnit === 'years' ? time * 12 : time))
  const n      = compoundingFreq === 'continuous' ? Infinity : N_MAP[compoundingFreq]
  // Months per discrete compounding period (1 for continuous/daily)
  const monthsPerPeriod =
    compoundingFreq === 'continuous' || compoundingFreq === 'daily'
      ? 1
      : Math.round(12 / n)
  const periodRate = r / (compoundingFreq === 'continuous' ? 12 : n)

  let balance       = principal
  let totalContribs = 0
  let totalWithdrs  = 0

  // Track current contribution amount (grows annually by contributionGrowthRate)
  let curMonthlyContrib = contributionFreq === 'monthly' ? contributionAmount : 0
  let curAnnualContrib  = contributionFreq === 'annual'  ? contributionAmount : 0
  const monthlyWithdrawal = withdrawalFreq === 'monthly' ? withdrawalAmount : 0
  const annualWithdrawal  = withdrawalFreq === 'annual'  ? withdrawalAmount : 0

  const breakdown: PeriodRow[] = []
  let yearOpening   = principal
  let yearInterest  = 0
  let yearContribs  = 0
  let yearWithdrs   = 0

  for (let month = 1; month <= totalMonths; month++) {
    const monthInYear = ((month - 1) % 12) + 1

    // Grow contributions at the start of each new year (after the first)
    if (monthInYear === 1 && month > 1) {
      const gf = 1 + contributionGrowthRate / 100
      curMonthlyContrib *= gf
      curAnnualContrib  *= gf
    }

    // ── Add contribution (beginning of period) ───────────────────────────────
    if (contributionFreq === 'monthly') {
      balance       += curMonthlyContrib
      yearContribs  += curMonthlyContrib
      totalContribs += curMonthlyContrib
    } else if (contributionFreq === 'annual' && monthInYear === 1) {
      balance       += curAnnualContrib
      yearContribs  += curAnnualContrib
      totalContribs += curAnnualContrib
    }

    // ── Apply interest ───────────────────────────────────────────────────────
    let interest = 0
    if (compoundingFreq === 'continuous') {
      const nb = balance * Math.exp(r / 12)
      interest = nb - balance
      balance  = nb
    } else if (compoundingFreq === 'daily') {
      // Approximate: apply (1 + r/365)^(365/12) each month
      const nb = balance * Math.pow(1 + r / 365, 365 / 12)
      interest = nb - balance
      balance  = nb
    } else if (month % monthsPerPeriod === 0 || month === totalMonths) {
      const nb = balance * (1 + periodRate)
      interest = nb - balance
      balance  = nb
    }
    yearInterest += interest

    // ── Apply withdrawal (end of period) ────────────────────────────────────
    if (withdrawalFreq === 'monthly') {
      const w    = Math.min(monthlyWithdrawal, Math.max(0, balance))
      balance   -= w
      yearWithdrs  += w
      totalWithdrs += w
    } else if (
      withdrawalFreq === 'annual' &&
      (monthInYear === 12 || month === totalMonths)
    ) {
      const w    = Math.min(annualWithdrawal, Math.max(0, balance))
      balance   -= w
      yearWithdrs  += w
      totalWithdrs += w
    }

    balance = Math.max(0, balance)

    // ── Record year-end row ──────────────────────────────────────────────────
    if (monthInYear === 12 || month === totalMonths) {
      const yearsElapsed = month / 12
      breakdown.push({
        period: Math.ceil(month / 12),
        openingBalance: yearOpening,
        interest: yearInterest,
        contributions: yearContribs,
        withdrawals: yearWithdrs,
        closingBalance: balance,
        realValue:
          inflR > 0 ? balance / Math.pow(1 + inflR, yearsElapsed) : balance,
      })
      yearOpening  = balance
      yearInterest = yearContribs = yearWithdrs = 0
    }
  }

  const futureValue        = balance
  const totalInterest      = Math.max(0, futureValue + totalWithdrs - principal - totalContribs)
  const effectiveAnnualRate =
    compoundingFreq === 'continuous'
      ? Math.exp(r) - 1
      : Math.pow(1 + r / n, n) - 1
  const doubleTime   = annualRate > 0 ? 72 / annualRate : null
  const totalYears   = totalMonths / 12
  const realValue    = inflR > 0 ? futureValue / Math.pow(1 + inflR, totalYears) : futureValue
  const simpleInterestFV = principal * (1 + r * totalYears)

  return {
    futureValue,
    totalInterest,
    totalContributions: totalContribs,
    totalWithdrawals: totalWithdrs,
    effectiveAnnualRate,
    doubleTime,
    realValue,
    simpleInterestFV,
    breakdown,
  }
}

// ─── Chart Data ───────────────────────────────────────────────────────────────

/**
 * Generate yearly data points for the growth and comparison charts.
 * Returns one point per year from year 0 to the final year.
 */
export function generateChartData(inputs: CompoundInterestInputs): ChartDataPoint[] {
  const { principal, annualRate, compoundingFreq } = inputs
  const r = annualRate / 100
  const n =
    compoundingFreq === 'continuous'
      ? Infinity
      : N_MAP[compoundingFreq as Exclude<CompoundingFrequency, 'continuous'>]

  const result = calculateCompoundInterest(inputs)
  const byYear  = new Map(result.breakdown.map((row) => [row.period, row]))
  const numYears = result.breakdown.length

  const points: ChartDataPoint[] = []
  let investedSoFar = principal

  // Year 0: no growth yet
  points.push({
    year: 0,
    totalValue: principal,
    investedCapital: principal,
    compoundOnly: principal,
    simpleOnly: principal,
  })

  for (let y = 1; y <= numYears; y++) {
    const row = byYear.get(y)

    investedSoFar += row?.contributions ?? 0

    const compoundOnly =
      compoundingFreq === 'continuous'
        ? principal * Math.exp(r * y)
        : principal * Math.pow(1 + r / n, n * y)

    const simpleOnly = principal * (1 + r * y)

    points.push({
      year: y,
      totalValue:      Math.round((row?.closingBalance ?? compoundOnly) * 100) / 100,
      investedCapital: Math.round(investedSoFar * 100) / 100,
      compoundOnly:    Math.round(compoundOnly * 100) / 100,
      simpleOnly:      Math.round(simpleOnly * 100) / 100,
    })
  }

  return points
}
