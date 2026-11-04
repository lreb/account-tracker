# Testing

## Completion gate
```bash
npm run ci:validate
```
This must run lint, tests and production build. Do not claim success unless commands were executed.

## Select the smallest relevant tests first
- Pure calculation: unit test beside `src/lib/` function.
- Store mutation: store test with mocked or isolated Dexie.
- Form behavior: Testing Library integration test.
- Migration: version upgrade test with representative old data.
- Critical end-to-end flow: Playwright when configured.

## Required regression areas
- transaction lifecycle and cancellation;
- linked transfers and atomicity;
- account balances and currency conversion;
- budget date boundaries;
- category references;
- JSON import/export;
- manual historical compaction;
- AI sanitizer and credential exclusion;
- local-time range boundaries;
- PWA production install behavior when changed.

## Accessibility
For changed UI, verify labels, keyboard operation, focus visibility, semantic roles, contrast and 44 by 44 CSS-pixel touch targets.

## Test data
Use deterministic fixtures. Avoid `Math.random()` unless seeded. Express money as integer minor units and use fixed ISO timestamps to prevent timezone-dependent failures.

## Agent acceptance report
At completion, report:
- focused tests executed;
- full gate status;
- untested platform/browser behavior;
- migrations or manual checks still required.
