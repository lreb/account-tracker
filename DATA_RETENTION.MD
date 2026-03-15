Data Retention Settings — Feature Spec
Settings screen: Settings > Data & Storage > Data Retention
Fields:
1. Full detail retention period
Dropdown — how many years back to keep full transaction detail.
Options: 1 year, 2 years, 3 years, 5 years, Forever
Default: 2 years
2. Auto-compaction
Toggle — whether the app automatically compacts periods older than the retention window.
Default: ON
3. Compaction behavior
Radio group — what happens to compacted periods:

Keep yearly snapshot only (default)
Keep monthly snapshots
Delete entirely after export

4. Archive access
Toggle — whether compacted years remain queryable in reports and charts (slower) or are hidden from the UI entirely.
Label: "Include archived periods in reports"
Default: OFF
5. Export before compaction
Toggle — prompt the user to export a CSV/JSON of the period before it gets compacted.
Default: ON

Background logic:

On app launch (or nightly background sync), evaluate all accounts: if any transaction's period exceeds full_detail_retention_period, queue it for compaction.
Compaction creates one yearly_snapshot record per (account_id, year, category) with total_in, total_out, and closing_balance.
Original transactions are soft-deleted (flagged archived = true), not hard-deleted, until the user explicitly confirms purge or exports first.
Compaction runs silently unless export_before_compaction = true, in which case a notification prompts the user before proceeding.


Data model additions:
tsyearly_snapshots {
  id
  account_id
  year          // e.g. 2021
  category_id   // nullable (null = total)
  total_in
  total_out
  closing_balance
  compacted_at
  transaction_count  // how many records were compacted
}

retention_settings {
  account_id         // nullable = global default
  detail_years       // 1 | 2 | 3 | 5 | null (forever)
  auto_compact       // boolean
  snapshot_granularity  // 'yearly' | 'monthly'
  archive_in_reports // boolean
  export_before_compact // boolean
}

Edge cases to handle:

If a vehicle fuel log entry falls within a compacted period, keep the odometer_reading and liters fields in the snapshot (extended snapshot schema for the fuel module).
If detail_years = Forever, the compaction job simply skips — no snapshots are created.
Warn the user if they try to reduce the retention window below the current oldest uncompacted transaction.