# Decision Log

Significant architectural and design decisions, with rationale and trade-offs.

---

## ADR-001: Local-First, Offline-First Architecture

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: Project Lead

### Decision

ExpenseTracking is built as a **local-first, offline-first** Progressive Web App. All data is stored in the user's device via IndexedDB (Dexie.js). No backend server or database service is used. Cloud sync (Google Drive / Dropbox) is optional and user-triggered.

### Rationale

1. **Privacy**: Users' financial data never leaves their device without explicit action
2. **Performance**: Zero latency for all UI operations; no network round-trips required
3. **Offline Capability**: App works fully without internet; essential for mobile use
4. **Cost**: No server infrastructure to maintain or scale
5. **Compliance**: Simplifies GDPR/data privacy regulations (data never transmitted)

### Trade-offs

- **Limitation**: No real-time sync across devices (user must manually export/import)
- **Limitation**: No cloud backup by default (user responsible for JSON exports)
- **Mitigated by**: Planned Google Drive / Dropbox sync feature (Tier 1)

### Alternatives Considered

1. **Backend + Cloud Sync**: Would add latency, complexity, and privacy concerns
2. **Hybrid (Cloud-First)**: Would break offline use case and complicate architecture

### Implementation

- **Dexie.js** for IndexedDB abstraction and schema versioning
- **Zustand** for in-memory state management (syncs to Dexie on mutation)
- **Vite PWA Plugin** for service worker generation and installability
- **Manual backup/restore** via JSON export (v1.0)
- **Cloud sync** planned for v1.1 (Google Drive, Dropbox)

---

## ADR-002: State Management with Zustand

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: Frontend Lead

### Decision

Use **Zustand** for global state management instead of Redux, MobX, or Recoil.

### Rationale

1. **Minimal Boilerplate**: No action types, reducers, or middleware setup
2. **Direct Mutations**: Intuitive store updates without indirection
3. **Bundle Size**: ~2 KB vs. Redux (~10 KB)
4. **Learning Curve**: Easier for new contributors
5. **Offline Fit**: Lightweight state container perfect for local-first apps

### Trade-offs

- **DevTools**: Redux DevTools not available (use browser DevTools for inspection)
- **Debugging**: Requires manual logging via `console.log` in store mutations
- **Middleware**: Custom middleware must be written if complex side effects needed

### Implementation

- One store per domain: `useTransactionsStore()`, `useAccountsStore()`, etc.
- All mutations wrap Dexie calls in try/catch → `toast.error()`
- Never call Dexie directly from components; always use store hooks

---

## ADR-003: Dexie.js for IndexedDB

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: Data Architect

### Decision

Use **Dexie.js** (IndexedDB abstraction) for persistent local storage instead of raw IndexedDB, localStorage, or embedded SQL (e.g., sql.js).

### Rationale

1. **Developer Experience**: Much cleaner API than raw IndexedDB
2. **Schema Versioning**: Built-in migration support (`version(n)` blocks)
3. **Querying**: Intuitive find/filter methods vs. IndexedDB's cursor API
4. **Performance**: Optimized indices and query execution
5. **Community**: Well-maintained, good documentation

### Trade-offs

- **Storage Limit**: IndexedDB quota is browser-dependent (~50 MB on Chrome)
- **Mitigated by**: Data compression + aggressive retention cleanup (7-year default)
- **No Full-Text Search**: Would need additional indexing strategy

### Alternatives Considered

1. **Raw IndexedDB**: Too verbose, no migrations, harder to test
2. **LocalStorage**: Too small (5–10 MB), synchronous API (blocks UI)
3. **sql.js**: Adds 3+ MB bundle size; overkill for this use case
4. **Firebase Realtime DB**: Violates offline-first + privacy requirements

### Implementation

- Single Dexie instance in `src/db/index.ts`
- Version blocks for all schema changes (never modify existing blocks)
- Stores handle Dexie I/O; components never call Dexie directly
- Migrations happen automatically on version mismatch

---

## ADR-004: React 19 + Vite for Tooling

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: Frontend Lead

### Decision

Use **React 19** with **Vite** as the bundler instead of CRA, Next.js, or Remix.

### Rationale

1. **Vite Speed**: Sub-second dev server startup and HMR
2. **Bundle Size**: ~30% smaller than CRA equivalent
3. **Modern Standards**: ES modules natively; no older browser support needed
4. **Config Simplicity**: Minimal setup; works out-of-the-box for PWAs
5. **React 19**: Latest stable features; better ref patterns, improved JSX

### Trade-offs

- **No Built-in API Routes**: Not needed (offline-first app)
- **No Image Optimization**: Acceptable; static assets optimized manually
- **SSR**: Not applicable (single-page app)

### Alternatives Considered

1. **Create React App**: Slower build, heavier bundle, less configurability
2. **Next.js**: Adds Node.js backend complexity (violates offline-first principle)
3. **Remix**: Similar issue; designed for full-stack apps

### Implementation

- `vite.config.ts` handles bundling, path aliases, PWA plugin
- `tsconfig.json` configured for strict mode
- ESLint + Prettier for code quality
- Pre-commit hooks via Husky + lint-staged

---

## ADR-005: shadcn/ui + Tailwind CSS for UI

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: Design System Lead

### Decision

Use **shadcn/ui** component library + **Tailwind CSS v4** for styling instead of Material-UI, Bootstrap, or custom CSS-in-JS.

### Rationale

1. **Accessibility**: WCAG 2.1 compliant components (Radix UI foundation)
2. **Customization**: Copy-paste approach allows full control over component code
3. **Bundle Size**: Components tree-shaken; only imported components included
4. **Utility-First**: Tailwind scales well for rapid UI iteration
5. **Mobile-First**: Responsive utilities make responsive design straightforward

### Trade-offs

- **Copy-Paste Dependency**: Components not auto-updated; requires manual CLI re-runs
- **Learning Curve**: Utility-first CSS requires rethinking vs. BEM/SCSS
- **No Pre-built Themes**: Customization required (shadcn/ui handles via CSS vars)

### Alternatives Considered

1. **Material-UI**: Heavy bundle; opinionated design not suitable for finance app
2. **Bootstrap**: Similar heaviness; less customizable
3. **Custom CSS**: Would consume more dev time; less accessible out-of-the-box

### Implementation

- shadcn CLI for component installation (`npx shadcn@latest add <component>`)
- Tailwind config in `tailwind.config.js`
- CSS variables for theming (light/dark mode)
- Mobile-first breakpoints: `sm:`, `md:`, `lg:`, `xl:`

---

## ADR-006: react-hook-form + zod for Forms

**Date**: 2024-Q2  
**Status**: ✅ Accepted  
**Owner**: Frontend Lead

### Decision

Use **react-hook-form** with **zod** validation instead of Formik, Yup, or raw React state.

### Rationale

1. **Performance**: Minimal re-renders via useForm + field-level subscriptions
2. **Type Safety**: zod provides runtime validation + TypeScript inference
3. **Bundle Size**: ~10 KB (vs. Formik's ~20 KB)
4. **Error Messages**: Automatic, composable error formatting
5. **Learning Curve**: Simpler than Formik for most use cases

### Trade-offs

- **Complexity for Dynamic Fields**: Advanced use cases need extra setup
- **Mitigated by**: Rarely needed; most forms are static layouts

### Implementation

- `zodResolver` integrates zod into react-hook-form
- Validation schemas co-located with feature modules (`src/features/<module>/schemas/`)
- Error rendering via `useFormState().errors`
- Async validation for availability checks (category rename, account balance)

---

## ADR-007: i18n with react-i18next (English-First)

**Date**: 2024-Q2  
**Status**: ✅ Accepted  
**Owner**: Product Manager

### Decision

Implement internationalization with **react-i18next**. English is the source language; Spanish is the first additional locale. All strings must go through `t()`.

### Rationale

1. **Global Reach**: Support users in English and Spanish-speaking markets
2. **Maintainability**: English source ensures consistency; translations added as needed
3. **Fallback**: Automatic English fallback if Spanish translation missing
4. **Community**: react-i18next is widely used; good documentation

### Trade-offs

- **Translation Effort**: Requires maintaining multiple language files
- **Mitigated by**: Clear JSON structure; easy for contributors to spot missing keys

### Implementation

- `src/i18n/en.json` (source)
- `src/i18n/es.json` (translation)
- `i18n.changeLanguage(code)` to switch at runtime
- Preference persisted in `settings` table
- New keys added to **both** files simultaneously

---

## ADR-008: Currency as Integer Cents

**Date**: 2024-Q2  
**Status**: ✅ Accepted  
**Owner**: Data Architect

### Decision

Store all monetary amounts as **integer cents** (e.g., 1234 = $12.34) to avoid floating-point arithmetic errors.

### Rationale

1. **Precision**: No rounding errors from floating-point math
2. **Accuracy**: Essential for financial data (every cent matters)
3. **Auditability**: Clear record of exact amounts without precision loss
4. **Standard**: Industry practice across banking and fintech

### Trade-offs

- **UI Display**: Must format via `formatCurrency()` for display
- **API Exchange**: Must convert from decimal inputs (form → cents, cents → display)

### Implementation

- Input fields accept decimal (e.g., 12.34)
- Form submission converts to cents: `Math.round(input * 100)`
- Display via `formatCurrency(cents, currency)` from `src/lib/currency.ts`
- All Dexie queries/calculations use cents exclusively

---

## ADR-009: Virtual Lists for Large Datasets

**Date**: 2024-Q3  
**Status**: ✅ Accepted  
**Owner**: Performance Lead

### Decision

Use **@tanstack/react-virtual** for rendering large transaction lists (1000+) to maintain smooth scrolling and sub-100ms render times.

### Rationale

1. **Performance**: Only visible rows rendered (DOM trees optimized)
2. **Responsiveness**: Smooth 60 FPS scrolling even with 10,000 transactions
3. **Memory**: Minimal memory footprint (not all rows in DOM)

### Trade-offs

- **Implementation Complexity**: Setup and maintain `estimateSize` logic
- **Browser Compatibility**: Requires modern browser (all targets support it)

### Implementation

- `useVirtualizer()` in `TransactionListPage`
- `estimateSize`: 40px for header, 88px for transaction row
- Scroll position preserved via React Router state

---

## ADR-010: Budget Calculation at Read Time

**Date**: 2024-Q3  
**Status**: ✅ Accepted  
**Owner**: Data Architect

### Decision

**Never store budget consumption as a derived field**. Calculate at read time by summing matching transactions.

### Rationale

1. **Consistency**: Always reflects current transaction state (no stale data)
2. **Simplicity**: No need to update derived field on every transaction change
3. **Queries**: Fast query with index on (categoryId, date)

### Trade-offs

- **Calculation Cost**: Small overhead per budget (negligible with proper indexing)
- **Mitigated by**: Dexie index on categoryId makes summation fast

### Implementation

- `getBudgetUsage(budgetId)` in `src/lib/budgets.ts`
- Returns `{ spent, limit, percent }`
- Called at render time for each budget card

---

## ADR-011: Cross-Currency Transfers via Exchange Rate Dialog

**Date**: 2024-Q3  
**Status**: ✅ Accepted  
**Owner**: Product Manager

### Decision

For account-to-account transfers with currency mismatch, use an **Exchange Rate Dialog** to confirm or fetch the live rate before transaction save.

### Rationale

1. **User Control**: Explicit rate confirmation prevents mistakes
2. **Rate Accuracy**: Optional live fetch from Frankfurter API ensures current rates
3. **Transparency**: User sees exactly what rate is being applied
4. **Offline Fallback**: Uses cached rate if offline; can fetch when online

### Trade-offs

- **Extra Step**: Adds one more tap vs. single-currency transfers
- **Mitigated by**: Dialog is only shown for cross-currency transfers (rare)

### Implementation

- `TransactionForm` detects currency mismatch
- Renders "Exchange Rate" button below destination account selector
- `CrossCurrencyDialog` opens on tap
- User can confirm cached rate or tap "Fetch rate" for live data
- Form stores `exchangeRate` + `originalAmount` / `originalCurrency`

---

## ADR-012: Data Retention & Auto-Delete

**Date**: 2024-Q3  
**Status**: ✅ Accepted  
**Owner**: Legal / Privacy Lead

### Decision

Implement **automatic deletion of transactions older than 7 years** (configurable via `retentionDays` setting).

### Rationale

1. **Privacy**: Users can be assured old financial data is automatically purged
2. **Storage Optimization**: Reduces IndexedDB quota impact over time
3. **Compliance**: Aligns with GDPR right-to-be-forgotten principles
4. **Audit Trail**: Transparent policy documented in `DATA_RETENTION.md`

### Trade-offs

- **Permanent Loss**: Deleted transactions cannot be recovered (except via JSON backup)
- **Mitigated by**: Clear warnings before deletion; JSON backups available

### Implementation

- Background job runs daily at app startup
- Deletes transactions where `date < now - retentionDays`
- Detailed logging in `src/lib/retention.ts`
- User can customize or disable via settings
- See [DATA_RETENTION.md](../DATA_RETENTION.md)

---

## ADR-013: Predefined Categories + User-Created Custom Categories

**Date**: 2024-Q2  
**Status**: ✅ Accepted  
**Owner**: Product Manager

### Decision

Ship with **15 predefined expense categories** (e.g., transportation, restaurants, utilities) and allow unlimited **custom categories** created by users.

### Rationale

1. **Quick Start**: Users can record transactions immediately without setup
2. **Flexibility**: Custom categories cover domain-specific use cases
3. **Organization**: Pre-defined hierarchy + custom extends coverage

### Trade-offs

- **Complexity**: Must handle both pre-defined (translated) and custom categories
- **UI Consistency**: Icon mapping required for custom categories

### Implementation

- Pre-defined categories have English names + icon mappings
- Custom categories created in Settings → Categories
- Renaming a pre-defined category updates label on all transactions (retroactively)
- Custom categories can be deleted only if unused by active transactions

---

## ADR-014: Frankfurter v2 API for Exchange Rates

**Date**: 2024-Q3  
**Status**: ✅ Accepted  
**Owner**: Backend Lead

### Decision

Use **Frankfurter v2 API** (`https://api.frankfurter.dev/v2`) for fetching exchange rates. No API key required.

### Rationale

1. **No Auth**: Public API; no key management needed
2. **Historical Data**: Supports point-in-time historical rates (useful for past transactions)
3. **Reliability**: Well-maintained; high uptime SLA
4. **Open Data**: Built on ECB data; transparent methodology

### Trade-offs

- **Rate Delay**: Rates update daily (not real-time)
- **Acceptable**: Sufficient for personal finance tracking

### Implementation

- `useExchangeRatesStore()` handles API calls
- `fetchFromApi(baseCurrency)` for bulk rate fetch (cached in DB)
- `fetchSinglePairRate(from, to)` for on-demand rate (transient, not persisted)
- Automatic fallback to cached rate if offline

**Important**: Always use `api.frankfurter.dev/v2` (not deprecated `api.frankfurter.app`)

---

## ADR-015: Offline-First Error Handling

**Date**: 2024-Q4  
**Status**: ✅ Accepted  
**Owner**: Frontend Lead

### Decision

Assume offline by default. Never fail the UI due to network unavailability. Gracefully degrade features that require online state.

### Rationale

1. **Resilience**: App always usable; network issues don't break user workflow
2. **Trust**: Users can rely on the app in poor connectivity areas
3. **Simple UX**: No "Retry" buttons or spinner loops for basic operations

### Trade-offs

- **Feature Availability**: Cloud sync, live rate fetching unavailable offline
- **Mitigated by**: Clear indication in UI (e.g., disabled buttons with tooltips)

### Implementation

- All API calls wrapped in try/catch
- Fallback to cached data if offline
- Toast warnings for degraded features (e.g., "Offline: Using cached rates")
- No blocking loader on network unavailability for essential features

---

## ADR-016: Tier 1 (Offline) vs. Tier 2 (Cloud AI) Insights

**Date**: 2024-Q4  
**Status**: ✅ Tier 1 Accepted | Tier 2 Planned

### Decision

Split insights into two tiers:
- **Tier 1** (v1.0): Offline statistical analysis (no API key)
- **Tier 2** (v1.2): Optional cloud AI (user-supplied OpenAI key)

### Rationale

1. **MVP Speed**: Ship Tier 1 immediately; users get insights without setup
2. **Privacy**: Tier 1 never transmits data; Tier 2 is opt-in
3. **Scalability**: Optional cloud avoids server cost for v1.0

### Implementation

- **Tier 1** (InsightsPage):
  - Recurring transaction detection
  - Category-vs-average alerts
  - Current-month spending projection
  - Fuel efficiency trends
- **Tier 2** (v1.2):
  - Optional OpenAI API key in Settings
  - Financial summary builder (aggregated totals only)
  - AI-powered analysis and recommendations

---

## ADR-017: No Analytics or Tracking

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: Legal / Privacy Lead

### Decision

**No analytics, telemetry, or tracking pixels** in the app. No data about user behavior is collected or transmitted.

### Rationale

1. **Privacy**: Financial data deserves maximum privacy protection
2. **Trust**: Users can audit and verify no data is leaving the device
3. **Compliance**: Simplifies GDPR, CCPA, and other privacy laws
4. **Performance**: No overhead from tracking libraries

### Trade-offs

- **No Usage Insights**: Team cannot see feature adoption or user flows
- **Mitigated by**: User feedback via issues/discussions; optional feature surveys

### Implementation

- No `gtag`, Mixpanel, Sentry, or similar libraries
- Error reporting is optional and requires user consent (future)
- No cookies or tracking pixels

---

## ADR-018: PWA Installation & Offline Support via Vite PWA Plugin

**Date**: 2024-Q1  
**Status**: ✅ Accepted  
**Owner**: DevOps Lead

### Decision

Use **Vite PWA Plugin** (based on Workbox) to generate service worker, manifest.json, and handle offline support.

### Rationale

1. **Configuration**: Minimal setup; auto-generates service worker
2. **Caching Strategy**: Intelligent cache versioning
3. **Installability**: One-click install on mobile home screen
4. **Standards**: Follows PWA best practices

### Trade-offs

- **Complexity**: Service worker debugging can be tricky
- **Mitigated by**: Clear DevTools access; good documentation

### Implementation

- `vite.config.ts` configures PWA plugin
- `public/manifest.json` defines app metadata
- Auto-generated `public/sw.js` for offline support
- Cache busting via content hash

---

## Future Decisions (TBD)

- **ADR-019**: Android Capacitor packaging strategy
- **ADR-020**: CI/CD pipeline for production deployments
- **ADR-021**: Tier 2 cloud AI integration (OpenAI key management)
