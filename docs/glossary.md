# Project Glossary

Only project-specific meanings are included.

- **Transaction:** Income, expense or transfer record. Cancelled records do not affect calculations.
- **Transfer:** Two linked transaction records sharing `transferId`.
- **Base currency:** Currency used to normalize reports; it does not change an account's native currency.
- **Reconciled:** Explicitly verified against an external statement.
- **Compacted transaction:** Generated annual summary replacing eligible historical detail after manual confirmation.
- **Financial Summary:** Sanitized aggregate that is the only financial payload approved for AI providers.
- **Hidden account:** Account omitted from default reports but retained for balances and history.
- **Cancelled account:** Closed account (`Account.cancelled`). Excluded from calculations. Separate from hidden.
- **Exchange rate:** `exchangeRate` converts account currency into base currency. One account unit equals `exchangeRate` base units.
- **Recurring transaction:** Scheduled reminder template in `RecurringTransaction`. It is not itself a posted transaction until applied.
- **Vehicle-linked transaction:** Transaction referenced by a fuel or service record; excluded from retention compaction.
- **Source truth:** Accepted ADR or business rule that defines intended behavior.
- **Implementation truth:** Current code and tests showing what the application does today.
