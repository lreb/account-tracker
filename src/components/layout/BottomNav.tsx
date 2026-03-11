import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ArrowLeftRight, BarChart2, Wallet, Car, Settings } from 'lucide-react'

const navItems = [
  { to: '/',             icon: LayoutDashboard, labelKey: 'nav.dashboard',     end: true },
  { to: '/transactions', icon: ArrowLeftRight,  labelKey: 'nav.transactions',  end: false },
  { to: '/reports',      icon: BarChart2,       labelKey: 'nav.reports',       end: false },
  { to: '/budgets',      icon: Wallet,          labelKey: 'nav.budgets',       end: false },
  { to: '/vehicles',     icon: Car,             labelKey: 'nav.vehicles',      end: false },
  { to: '/settings',     icon: Settings,        labelKey: 'nav.settings',      end: false },
] as const

export default function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 bg-white border-t">
      {navItems.map(({ to, icon: Icon, labelKey, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          <Icon size={22} strokeWidth={1.75} />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
