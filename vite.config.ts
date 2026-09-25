import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)
const appVersion = packageJson.version || '0.0.0'

// function getBasePath(): string {
//   const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
//   if (!repo) return '/'
//   if (repo.endsWith('.github.io')) return '/'
//   return `/${repo}/`
// }

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'MainLogo-16x16.ico',
        'MainLogo-512x512.svg',
        'MainLogo-apple-touch-180x180.png',
      ],
      // Ensure the service worker intercepts all navigation requests and falls back to
      // index.html. Without this, launching the PWA after it's been closed can bypass
      // the service worker and open in a regular browser tab.
      workbox: {
        navigateFallback: 'index.html',
        // Exclude API and OAuth redirect routes from the SPA fallback so they are
        // handled by the network (or produce a proper 404) rather than serving HTML.
        // Google sign-in / Drive traffic never hits these routes — it goes to
        // accounts.google.com and googleapis.com, which the service worker ignores.
        navigateFallbackDenylist: [/^\/api\//, /^\/oauth-callback/],
        cleanupOutdatedCaches: true,
        // No runtimeCaching: all financial data lives in IndexedDB (offline by
        // design), static assets are precached at build time, and API/auth/OAuth
        // responses must never be served stale from a cache.
      },
      manifest: {
        name: 'ExpenseTracking by Facware',
        short_name: 'Expenses',
        description:
          'Track income and expenses, organize transactions, and turn spending into actionable insights.',
        lang: 'en',
        dir: 'ltr',
        categories: ['finance', 'productivity', 'utilities'],
        theme_color: '#4f46e5',
        // Matches the app shell background (bg-gray-50) so the splash screen
        // blends into first paint instead of flashing dark.
        background_color: '#f9fafb',
        // `id` is the stable identifier for this PWA. Browsers use it to match an
        // existing installation so that updates to the manifest don't create a second
        // entry on the home screen.
        id: '/',
        // `start_url` tells the OS exactly which URL to launch when the user taps the
        // home screen icon. Without it, Chrome uses the URL that was active when "Add
        // to Home Screen" was tapped — which can be any route — causing the app to
        // open in a browser tab on subsequent cold launches.
        // The `?source=pwa` param is the most reliable way to detect a true home-screen
        // launch: the OS always injects it, a plain browser tab never will.
        start_url: '/?source=pwa',
        // `scope` defines the set of URLs that belong to this PWA. Any navigation
        // within the scope is handled by the service worker; navigations outside it
        // open in the default browser, which is the correct behaviour.
        scope: '/',
        display: 'standalone',
        // Browsers try these in order and fall back to `display`. Listing
        // window-controls-overlay first enables the richer desktop title-bar mode
        // where supported (Windows/Edge/Chrome); minimal-ui covers the rest.
        // NOTE: previously this listed 'standalone' (== display, a no-op) first.
        display_override: ['window-controls-overlay', 'minimal-ui'],
        // No `orientation` lock: tablets and foldables can use landscape for
        // wide tables and charts.
        icons: [
          { src: 'MainLogo-64x64.png', sizes: '64x64', type: 'image/png', purpose: 'any' },
          { src: 'MainLogo-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: 'MainLogo-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: 'MainLogo-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: 'MainLogo-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          // NOTE: previously MainLogo-198x198.png was declared as 192x192, which
          // Chromium can reject. This is now an exact 192x192 render.
          { src: 'MainLogo-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'MainLogo-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: 'MainLogo-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Maskable icons are cropped to a circle/squircle: only the central
          // ~80%-diameter circle is guaranteed visible. This variant carries the
          // artwork scaled to 80% on transparency; never reuse a full-bleed icon here.
          {
            src: 'MainLogo-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Placeholder captures — replace with real screenshots (same filenames or
        // update the src below). `label` is shown in the install UI.
        screenshots: [
          {
            src: 'screenshots/placeholder-dashboard-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Dashboard',
          },
          {
            src: 'screenshots/placeholder-reports-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Reports',
          },
          {
            src: 'screenshots/placeholder-dashboard-narrow.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Dashboard',
          },
          {
            src: 'screenshots/placeholder-budgets-narrow.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Budgets',
          },
        ],
      },
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    globals: true,
  },
})
