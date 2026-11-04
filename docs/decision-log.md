# Architecture Decision Log

Only decisions that constrain future implementation belong here. Detailed implementation history belongs in Git.

## Index
| ADR | Decision | Status |
|---|---|---|
| 001 | Local-first, offline-first PWA | Accepted |
| 002 | Zustand as state mutation boundary | Accepted |
| 003 | Dexie over IndexedDB | Accepted |
| 004 | React 19 and Vite | Accepted |
| 005 | Integer minor units for money | Accepted |
| 006 | Deterministic financial calculations | Accepted |
| 007 | BYOK, provider-agnostic AI | Accepted |
| 008 | Manual historical compaction | Accepted, supersedes automatic deletion |
| 009 | Vite PWA Plugin owns manifest and service worker | Accepted |

## ADR-001: Local-first, offline-first PWA
All core data and processing remain on device. No backend is required. External services are optional and user-triggered.

## ADR-002: Zustand mutation boundary
Components use Zustand stores for application data. Stores coordinate validation, Dexie persistence and memory updates. Direct component-to-Dexie access is prohibited.

## ADR-003: Dexie persistence
Dexie provides IndexedDB access and immutable versioned migrations. Schema changes always create a new version block.

## ADR-004: React and Vite
The application is a client-side React PWA built with Vite. Server-side rendering and API routes are outside the architecture unless a future ADR changes the local-first model.

## ADR-005: Integer minor units
Authoritative money uses integer minor units to avoid binary floating-point errors. Formatting and decimal input conversion occur at boundaries.

## ADR-006: Deterministic financial calculations
Balances, budgets, rates, totals, retention aggregation and report metrics are computed by tested deterministic code. AI is limited to interpretation of sanitized aggregates.

## ADR-007: BYOK AI integration
Users configure their own compatible provider. AI is optional, provider-agnostic and must not weaken offline core behavior. Only the approved `FinancialSummary` may cross the privacy boundary.

## ADR-008: Manual historical compaction
Status: accepted. Supersedes the previous automatic seven-year deletion proposal.

A year is eligible when `year <= currentUTCYear - 5`, matching `getCompactableTransactionYears`. Year bounds in `getYearBounds` are UTC `Z` strings. Do not change those bounds to the local-day rule in `docs/architecture.md`. The user must export the selected year during the current session and explicitly confirm. Vehicle-linked transactions are excluded. Detailed eligible transactions are replaced with annual summary records grouped by type, account, category and currency. No scheduled deletion job or retention-days setting is allowed.

## ADR-009: Plugin-owned PWA artifacts
`vite-plugin-pwa` generates the manifest and service worker. A hand-authored `public/manifest.webmanifest` is prohibited because it can collide with generated output.

## Superseded decisions
- Automatic daily deletion after seven years: superseded by ADR-008.
- API keys as transient-only values: superseded by local IndexedDB storage with export/logging exclusions.
- Hand-authored manifest or service worker: superseded by ADR-009.
