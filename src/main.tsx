import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster, toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import i18n from './i18n'
import './index.css'
import App from './app/App'

// Register the service worker and check for updates on launch. With
// registerType 'autoUpdate' the new worker activates in the background, but
// the running page keeps the old assets until reloaded — so surface a
// persistent toast and let the user reload when safe (never force a reload
// while they may be entering financial data).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast(i18n.t('pwa.updateAvailable'), {
      description: i18n.t('pwa.updateAvailableDesc'),
      action: {
        label: i18n.t('pwa.reload'),
        onClick: () => void updateSW(true),
      },
      duration: Infinity,
      id: 'pwa-update',
    })
  },
  onOfflineReady() {
    toast.success(i18n.t('pwa.offlineReady'), { id: 'pwa-offline-ready' })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <App />
    </Suspense>
    <Toaster position="top-center" richColors />
  </StrictMode>,
)
