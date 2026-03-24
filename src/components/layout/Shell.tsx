import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Header from './Header'
import ErrorBoundary from './ErrorBoundary'

export default function Shell() {
  const { pathname } = useLocation()

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      <Header />
      <main id="main-scroll" className="flex-1 overflow-y-auto pb-16">
        {/* key={pathname} resets the boundary on every navigation so a crash in one route never bleeds into another */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  )
}
