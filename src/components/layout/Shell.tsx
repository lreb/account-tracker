import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import ErrorBoundary from './ErrorBoundary'
import { usePWAInstall } from '@/features/settings/hooks/usePWAInstall'

export default function Shell() {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { t } = useTranslation()
  const { isInstalled, isStandalone } = usePWAInstall()

  // Show a banner only when the app is installed on the home screen but the user
  // accidentally opened a browser tab instead of launching the standalone PWA.
  const showBrowserBanner = isInstalled && !isStandalone && !bannerDismissed

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {showBrowserBanner && (
        <div className="flex items-center gap-2 bg-indigo-600 px-4 py-2 text-white text-xs">
          <span className="flex-1">{t('shell.openInAppBanner')}</span>
          <button
            aria-label={t('common.dismiss')}
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 rounded p-0.5 hover:bg-white/20 active:bg-white/30"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <main id="main-scroll" className="flex-1 overflow-y-auto">
        {/* key={pathname} resets the boundary on every navigation so a crash in one route never bleeds into another */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}
