import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

function getBasePath(): string {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo) return '/'
  if (repo.endsWith('.github.io')) return '/'
  return `/${repo}/`
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? getBasePath() : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png', 'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png'],
      // Ensure the service worker intercepts all navigation requests and falls back to
      // index.html. Without this, launching the PWA after it's been closed can bypass
      // the service worker and open in a regular browser tab.
      workbox: {
        navigateFallback: 'index.html',
        // Exclude API and OAuth redirect routes from the SPA fallback so they are
        // handled by the network (or produce a proper 404) rather than serving HTML.
        navigateFallbackDenylist: [/^\/api\//, /^\/oauth-callback/],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'ExpenseTracking',
        short_name: 'Expenses',
        description: 'Personal finance and expense tracking PWA',
        theme_color: '#4f46e5',
        background_color: '#1a1a1a',
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
        // `display_override` lets browsers that support newer display modes (e.g.
        // window-controls-overlay on desktop) pick a richer mode while still falling
        // back to `display: standalone` on Android and iOS.
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
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
