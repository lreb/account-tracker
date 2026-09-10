# ExpenseTracking — Agent Instructions

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Serve production build locally (port 4173) |
| `npm run test` | Run all Vitest unit tests once |
| `npm run test -- <file>` | Run single test file |
| `npm run lint` | ESLint on `src/` (zero warnings allowed) |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run ci:validate` | **Pre-commit gate**: lint + test + build |

## Architecture Essentials

- **Framework**: React 19 + Vite 6 + TypeScript (strict)
- **State**: Zustand stores in `src/stores/` — **only** way to mutate data
- **DB**: Dexie.js (IndexedDB) singleton at `src/db/index.ts` — v9
- **Forms**: react-hook-form + zod schemas in `src/features/<module>/schemas/`
- **Routing**: `createBrowserRouter` in `src/app/router.tsx`
- **Styling**: Tailwind CSS v4 + shadcn/ui (CLI-managed in `src/components/ui/`)
- **i18n**: react-i18next — **no hardcoded strings in JSX**

## Critical Conventions

### Data & DB
- Currency values stored as **integers (cents)** — avoid floating point
- Exchange rates: Frankfurter v2 API (`api.frankfurter.dev/v2`)
- **Dexie migrations**: Every schema change → new `.version(n)` block in `src/db/index.ts` (never edit existing versions)
- Cross-currency transfers create **two linked records** sharing `transferId`

### Code Organization
- Feature modules: `src/features/<domain>/` (components, hooks, schemas)
- Pure utilities: `src/lib/` (currency, budgets, vehicles, dates, insights)
- Shared hooks: `src/hooks/` (only if used by 2+ features)
- `@/` alias maps to `src/` (configured in vite.config.ts + tsconfig.json)

### Linting Rules (enforced, block commits)
- `@typescript-eslint/no-unused-vars: error` — unused imports = error
- `react-refresh/only-export-components: warn` — `.tsx` must export only React components; move types/constants to companion `.types.ts`

### Testing
- Unit tests: Vitest + jsdom + `@testing-library/react`
- Run single file: `npm run test -- src/lib/categories.test.ts`
- Keep regression tests when fixing bugs

### Pre-commit Hook
Husky runs `npm run ci:validate` (lint → test → build) on staged `src/**/*.{ts,tsx}`. **Commits blocked on any error.**

## Environment
- Copy `.env.example` → `.env` for local Google Drive sync
- `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` required for Drive
- Version from `package.json` injected as `__APP_VERSION__` at build time

## CI/CD
- GitHub Actions: push to `main` → lint/test/build → deploy to GitHub Pages
- Workflow: `.github/workflows/deploy-pages.yml`
- SPA fallback: `dist/404.html` copy for GitHub Pages routing

## Key Files to Reference
- `docs/architecture.md` — system layers, patterns, performance
- `docs/business-rules.md` — transaction lifecycle, budgets, currency
- `docs/api-contracts.md` — TypeScript interfaces, store contracts, backup formats
- `docs/decision-log.md` — 18 ADRs (Zustand, Dexie, React 19, offline-first, etc.)
- `.github/copilot-instructions.md` — detailed hook/store reference, conventions