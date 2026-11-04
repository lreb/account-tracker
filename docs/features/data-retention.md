# Historical Data Retention

## Canonical policy
Retention is explicit manual compaction. There is no automatic or scheduled deletion.

## Scope
- Applies only to the `transactions` table.
- A year is eligible when `year <= currentUTCYear - 5`, matching `getCompactableTransactionYears` in `src/lib/retention.ts`.
- Year bounds in `getYearBounds` are UTC `Z` strings (`YYYY-01-01T00:00:00.000Z` through `YYYY-12-31T23:59:59.999Z`). Do not change those bounds to the local-day rule in `docs/architecture.md`.
- Transactions linked to fuel logs or vehicle services are excluded.
- Fuel logs, service records and other tables are not compacted by this feature.

## Required flow
1. User selects an eligible year.
2. Application calculates and displays the eligible and excluded counts.
3. User exports that year's transactions to CSV during the current session.
4. Application records an in-memory export gate for that selected year.
5. User reviews a summary preview and explicitly confirms.
6. One Dexie transaction writes summary rows and removes only eligible detailed rows.
7. Application reports the result and refreshes stores.

Changing the selected year resets the export gate. The gate is intentionally not persisted across sessions.

## Aggregation
Group eligible transactions by:
```text
type + accountId + categoryId + currency
```
Transfers are folded into:
- expense for the source account;
- income for the destination account.

Generated rows:
- use the end of the selected year as their date;
- retain integer minor-unit totals;
- use a stable generated marker and notes indicating compaction;
- must not collide with ordinary or previously generated records.

## Invariants
- Annual income, expense and account continuity remain coherent at summary level.
- Excluded vehicle-linked transactions remain unchanged.
- Failure rolls back the entire operation.
- Re-running compaction must not double-count or duplicate summaries.
- No `retentionDays`, nightly job or startup deletion behavior is allowed.

## Required tests
- eligibility boundary;
- export gate and year-change reset;
- grouping by all four dimensions;
- transfer folding;
- vehicle-link exclusion;
- cancelled-record treatment consistent with reports;
- atomic rollback;
- idempotency;
- before/after annual totals.
