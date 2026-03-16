Data Retention Settings — Feature Spec (Current)

Scope
- Applies only to financial transactions in the `transactions` table.
- Does NOT apply to vehicle/fuel/service records.
- Any transaction linked to fuel logs/services is excluded from compaction.

Goal
- Reduce old transaction detail volume to improve performance.
- Keep yearly financial continuity by replacing detailed rows with compact summary rows.

Settings screen
- Location: Settings > Data Retention

Manual compaction flow
1. User selects a year to compact.
2. User must export that year's transactions first (CSV).
3. User confirms compaction.
4. App generates yearly compacted summary transactions and replaces detailed rows for that year.

Retention rules
- Eligible years are years older than 5 years from the current year.
- Compaction is manual only.
- No automatic/nightly compaction job.

Compaction behavior
- Triggered once per explicit user action.
- Source set: transactions in selected year, excluding vehicle-linked transactions.
- Replace detailed rows with generated summary transactions:
  - Aggregation key: `type (income|expense) + accountId + categoryId + currency`.
  - Transfers are folded into:
    - expense for source account
    - income for destination account
- Generated summary rows are dated at end of selected year and tagged in notes as compacted output.

Export-before-compact requirement
- Compaction action remains blocked until export for selected year is completed in-session.
- If year selection changes, export requirement resets for new year.

Data model decision
- No extra snapshot table is introduced in this phase.
- Compaction output is persisted in `transactions` as generated summary records.

Expected outcome
- Fewer detailed rows for historical years.
- Reports and balances remain coherent at annual summary level.
- Better runtime performance with large historical datasets.