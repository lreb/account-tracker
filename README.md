# ExpenseTracking

A personal finance Progressive Web App (PWA) + Android application. Record income and expenses, track vehicle fuel and maintenance, and view reports. **No backend, no database service** — all data lives on your device via IndexedDB.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 LTS | https://nodejs.org |
| npm | ≥ 10 (bundled with Node) | — |
| Git | any | https://git-scm.com |

> Android builds additionally require **Android Studio** and the **Java 17+ JDK** (see [Android section](#android-build-capacitor)).

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd expense-tracker

# 2. Install all dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173** (Vite may pick 5174+ if 5173 is in use).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with hot-reload |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | React | ^19 |
| Bundler | Vite | ^6 |
| Language | TypeScript (strict) | ~5.7 |
| Styling | Tailwind CSS v4 + shadcn/ui | ^4 |
| Routing | react-router-dom | ^7 |
| State | Zustand | ^5 |
| Local DB | Dexie.js (IndexedDB) | ^4 |
| Forms | react-hook-form | ^7 |
| Validation | zod | ^3 |
| Toasts | sonner | ^1 |
| Icons | lucide-react | ^0.475 |
| i18n | react-i18next | ^15 |
| Date utils | date-fns | ^4 |
| ID generation | uuid | ^13 |

---

## Project Structure

```
src/
├── app/
│   ├── App.tsx              # Root component, store bootstrapping, RouterProvider
│   └── router.tsx           # All routes (createBrowserRouter)
├── components/
│   ├── ui/                  # shadcn/ui primitives — do not edit manually
│   └── layout/              # Shell, Header, BottomNav
├── features/
│   ├── transactions/        # Form, list, schemas
│   ├── vehicles/
│   ├── reports/
│   ├── budgets/
│   ├── insights/
│   └── settings/            # Accounts, categories, labels, exchange rates
├── db/
│   └── index.ts             # Dexie singleton — all table definitions
├── stores/                  # Zustand stores (one per domain)
├── lib/                     # Pure utility functions (currency, budgets, vehicles, dates)
├── hooks/                   # Shared custom hooks
├── types/                   # TypeScript interfaces and enums
└── i18n/                    # react-i18next setup + en.json / es.json
```

---

## Adding shadcn/ui Components

Components are added individually using the shadcn CLI:

```bash
npx shadcn@latest add <component-name>

# Examples:
npx shadcn@latest add button
npx shadcn@latest add card badge input label select textarea sheet dialog drawer
```

Components are generated into `src/components/ui/`. **Do not edit these files manually** — re-run the CLI to update them.

---

## Environment & Path Aliases

The `@/` alias maps to `src/`. Configured in both `vite.config.ts` and `tsconfig.json`:

```ts
// vite.config.ts
resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }

// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```

---

## Data Storage

All data is stored locally in **IndexedDB** via Dexie.js. No data ever leaves the device unless the user explicitly triggers an export (JSON backup, PDF, CSV) or a cloud sync (Google Drive / Dropbox — planned).

**Database tables:** transactions, accounts, categories, budgets, vehicles, fuelLogs, vehicleServices, labels, exchangeRates, settings.

### Schema migrations

Every structural change to the Dexie schema **must** add a new `.version(n)` block in [`src/db/index.ts`](src/db/index.ts). Never modify existing version blocks.

---

## Internationalization

The app ships with English (`en`) and Spanish (`es`) locales in `src/i18n/`. All user-facing strings go through `react-i18next` — no hardcoded strings in JSX.

---

## Android Build (Capacitor)

> Capacitor integration is planned but not yet configured. These steps will apply once `@capacitor/core` and `@capacitor/android` are added.

```bash
# 1. Build the web app
npm run build

# 2. Sync to native project
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

---

## Production Build

```bash
npm run build
# Output: dist/
```

To preview the production build locally:

```bash
npm run preview
# Available at http://localhost:4173
```

---

## Type Checking

```bash
npx tsc --noEmit
```

Must return zero errors before committing.
