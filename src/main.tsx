import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './i18n'
import './index.css'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <App />
    </Suspense>
    <Toaster position="top-center" richColors />
  </StrictMode>,
)
