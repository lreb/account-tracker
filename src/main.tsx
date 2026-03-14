import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import './i18n'
import './index.css'
import App from './app/App'

// Automatically check for updates and register service worker
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <App />
    </Suspense>
    <Toaster position="top-center" richColors />
  </StrictMode>,
)
