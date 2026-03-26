import { useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Scale,
  BarChart3,
  PiggyBank,
  Car,
  Lightbulb,
  Settings,
  Plus,
  Fuel,
  Wrench,
  Wallet,
  Tag,
  RefreshCw,
  X,
} from 'lucide-react'
import { useVehiclesStore } from '@/stores/vehicles.store'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const mainItems = [
  { to: '/',              icon: LayoutDashboard, labelKey: 'nav.dashboard',    end: true },
  { to: '/transactions',  icon: ArrowLeftRight,  labelKey: 'nav.transactions', end: false },
  { to: '/balance-sheet', icon: Scale,           labelKey: 'nav.balanceSheet', end: false },
  { to: '/reports',       icon: BarChart3,       labelKey: 'nav.reports',      end: false },
  { to: '/budgets',       icon: PiggyBank,       labelKey: 'nav.budgets',      end: false },
  { to: '/vehicles',      icon: Car,             labelKey: 'nav.vehicles',     end: false },
  { to: '/insights',      icon: Lightbulb,       labelKey: 'nav.insights',     end: false },
  { to: '/settings',      icon: Settings,        labelKey: 'nav.settings',     end: true },
] as const

const settingsItems = [
  { to: '/settings/accounts',       icon: Wallet,    labelKey: 'settings.accounts' },
  { to: '/settings/categories',     icon: Tag,       labelKey: 'settings.categories' },
  { to: '/settings/labels',         icon: Tag,       labelKey: 'settings.labels' },
  { to: '/settings/exchange-rates', icon: RefreshCw, labelKey: 'settings.exchangeRates' },
] as const

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { vehicles } = useVehiclesStore()
  const activeVehicles = useMemo(() => vehicles.filter((v) => !v.archivedAt), [vehicles])

  // Close sidebar on route change
  useEffect(() => {
    onClose()
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
          <span className="font-semibold text-lg tracking-tight text-gray-900">
            ExpenseTracking
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={t('common.cancel')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <nav className="flex-1 overflow-y-auto py-2">
          {/* ── Main ────────────────────────────────────── */}
          <div className="px-3 mb-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t('sidebar.main')}
            </p>
          </div>
          <ul className="space-y-0.5 px-3">
            {mainItems.map(({ to, icon: Icon, labelKey, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{t(labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {/* ── Quick Create ────────────────────────────── */}
          <div className="mt-4 px-3 mb-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t('sidebar.quickCreate')}
            </p>
          </div>
          <ul className="space-y-0.5 px-3">
            <li>
              <NavLink
                to="/transactions/new"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Plus size={18} className="shrink-0" />
                <span>{t('transactions.addTransaction')}</span>
              </NavLink>
            </li>
            {activeVehicles.length === 1 ? (
              <>
                <li>
                  <NavLink
                    to={`/vehicles/${activeVehicles[0].id}/fuel/new`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Fuel size={18} className="shrink-0" />
                    <span>{t('vehicles.addFuelLog')}</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to={`/vehicles/${activeVehicles[0].id}/service/new`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Wrench size={18} className="shrink-0" />
                    <span>{t('vehicles.addService')}</span>
                  </NavLink>
                </li>
              </>
            ) : activeVehicles.length > 1 ? (
              activeVehicles.map((v) => (
                <li key={v.id}>
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    {v.name}
                  </p>
                  <NavLink
                    to={`/vehicles/${v.id}/fuel/new`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Fuel size={18} className="shrink-0" />
                    <span>{t('vehicles.addFuelLog')}</span>
                  </NavLink>
                  <NavLink
                    to={`/vehicles/${v.id}/service/new`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Wrench size={18} className="shrink-0" />
                    <span>{t('vehicles.addService')}</span>
                  </NavLink>
                </li>
              ))
            ) : null}
          </ul>

          {/* ── Settings shortcuts ──────────────────────── */}
          <div className="mt-4 px-3 mb-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t('sidebar.settings')}
            </p>
          </div>
          <ul className="space-y-0.5 px-3 pb-4">
            {settingsItems.map(({ to, icon: Icon, labelKey }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{t(labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
