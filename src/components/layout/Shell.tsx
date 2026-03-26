import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import ErrorBoundary from './ErrorBoundary'

export default function Shell() {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
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
