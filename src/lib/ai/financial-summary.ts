// ─── Financial Summary ────────────────────────────────────────────────────────
// Re-export the canonical implementation to avoid maintaining duplicate summary
// builders with the same API under multiple paths.

export type {
  CategorySummary,
  BudgetStatusSummary,
  FinancialSummary,
} from '../ai-financial-summary'
export { buildFinancialSummary } from '../ai-financial-summary'

/** Format a FinancialSummary as a concise text block for the AI prompt. */
export function formatSummaryForPrompt(s: FinancialSummary): string {
  const curr = (cents: number) => `${(cents / 100).toFixed(2)} ${s.baseCurrency}`

  const lines = [
    `Period: ${s.period}`,
    `Income: ${curr(s.totalIncome)}`,
    `Expenses: ${curr(s.totalExpenses)}`,
    `Net cash flow: ${curr(s.netCashFlow)}`,
    '',
    'Expenses by category:',
    ...s.byCategory.map((c) => `  ${c.label}: ${curr(c.amount)}`),
  ]

  if (s.budgetStatus.length > 0) {
    lines.push('', 'Budget status:')
    for (const b of s.budgetStatus) {
      lines.push(`  ${b.label}: ${curr(b.spent)} / ${curr(b.limit)} (${b.pct}%)`)
    }
  }

  lines.push(
    '',
    `Spending projection: ${curr(s.projection.projectedMonthlyExpense)} for the full month`,
    `(${s.projection.daysElapsed} of ${s.projection.daysInMonth} days elapsed)`,
  )

  return lines.join('\n')
}
