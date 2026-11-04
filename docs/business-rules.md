# Business Rules

This document is the canonical source for domain behavior.

## Transactions
- Types are `income`, `expense` and `transfer`.
- Statuses are `pending`, `cleared`, `reconciled` and `cancelled`.
- Future-dated manual entries default to `pending`; other manual entries default to `cleared`.
- Cancelled transactions remain historical records but affect no balance, budget, report, insight or AI summary.
- Monetary amounts are positive integer minor units. Direction comes from transaction type and account role, not negative storage values.

## Transfers
- Every transfer creates two linked records sharing `transferId`.
- Source record: `expense` against the source account.
- Destination record: `income` against the destination account.
- Both records must be created, updated or removed atomically.
- Cross-currency transfers require an explicit rate confirmation.
- `exchangeRate` means source currency to destination currency.

## Reconciliation
- Normal progression: `pending → cleared → reconciled`.
- Moving backward requires an explicit edit and user confirmation.
- Reconciled records may be corrected through an auditable explicit edit, not silent mutation.

## Accounts and balances
- Each account has one ISO 4217 currency.
- Current balance equals opening balance plus non-cancelled income and transfer-in records minus non-cancelled expense and transfer-out records.
- Hidden accounts remain valid and keep balances, but are omitted from user-selected consolidated reports unless explicitly requested.

## Categories and labels
- A transaction has one category and zero or more labels.
- Predefined categories cannot be deleted.
- A custom category cannot be deleted while referenced by active records.
- Rename category metadata instead of rewriting transaction history when transactions reference category IDs.

## Budgets
- A budget belongs to one category and has weekly, monthly or yearly frequency.
- Consumption is derived at read time from non-cancelled expenses in the applicable period.
- Do not persist consumption as authoritative state.
- Status thresholds: green below 75%, amber from 75% through 99.99%, red at or above 100%.
- Notification thresholds are 80% and 100%, when notifications are enabled.

## Vehicles
- Vehicle removal is archival, not destructive deletion.
- Fuel and service records may optionally link to an expense transaction.
- Odometer progression must be validated.
- Fuel efficiency and cost-per-distance are derived values.

## Exchange rates
- Frankfurter v2 is the default public provider.
- Fetching is user-triggered; cached or manually entered rates support offline use.
- A missing rate is explicit. Never treat one currency's amount as another currency.

## Reports and deterministic insights
- Calculations use code, not an LLM.
- Reports obey selected accounts, categories, labels and local date boundaries.
- Recurring-pattern and anomaly algorithms must expose their formula and remain testable.
- AI may interpret prepared aggregates but cannot replace exact calculations.

## Historical retention
Historical transactions use manual compaction, not automatic deletion. The detailed canonical rules are in `features/data-retention.md`.

## Import and export
- Full JSON backup is versioned and validated before import.
- Restore is atomic: validate before replacing current data.
- CSV exports contain the user-selected scope.
- AI credentials, OAuth tokens and transient provider state are excluded from backup exports.
