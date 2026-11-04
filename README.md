# ExpenseTracking

A local-first, offline-first personal-finance Progressive Web App built with React, TypeScript, Zustand and Dexie. Users retain control of their data; network features such as exchange-rate lookup, cloud backup and AI analysis are explicit and optional.

## Main capabilities
- Income, expense and transfer tracking
- Accounts and multi-currency balances
- Budgets, reports and deterministic insights
- Vehicle fuel and service records
- JSON/CSV export and restore
- Optional BYOK AI analysis using sanitized aggregates
- Manual compaction of eligible historical transactions

## Development
```bash
npm install
npm run dev
npm run ci:validate
npm run preview
```

## Documentation
Start with `AGENTS.md` for both contributors and coding agents. It routes tasks to the smallest relevant document.

- `docs/architecture.md`: layers and data flow
- `docs/business-rules.md`: canonical domain behavior
- `docs/data-model.md`: core models and persistence contracts
- `docs/decision-log.md`: accepted and superseded decisions
- `docs/security.md`: privacy and credential handling
- `docs/features/`: focused feature specifications
- `docs/operations/`: testing and deployment procedures

Do not use the README as implementation authority. Canonical precedence is defined in `AGENTS.md`.

## Links
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lreb/account-tracker)

[![Github Page Access - Launch ExpenseTracking](https://img.shields.io/badge/DNS%20Access-Launch%20ExpenseTracking-0ea5e9?style=for-the-badge&logo=vercel&logoColor=white&labelColor=1e293b)](https://lreb.github.io/account-tracker/)

[![expense-tracking.facware.com - DNS Access - Launch ExpenseTracking](https://img.shields.io/badge/DNS%20Access-Launch%20ExpenseTracking-0ea5e9?style=for-the-badge&logo=vercel&logoColor=white&labelColor=1e293b)](https://expense-tracking.facware.com)