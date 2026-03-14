import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Derive the page title from the current path
const titleMap: Record<string, string> = {
  '/':                    'nav.dashboard',
  '/transactions':        'nav.transactions',
  '/balance-sheet/':      'balanceSheet.detailTitle',
  '/balance-sheet':       'balanceSheet.title',
  '/vehicles':            'nav.vehicles',
  '/reports':             'nav.reports',
  '/budgets':             'nav.budgets',
  '/insights':            'nav.insights',
  '/settings':            'nav.settings',
  '/settings/accounts':   'settings.accounts',
  '/settings/categories': 'settings.categories',
  '/settings/labels':     'settings.labels',
  '/settings/exchange-rates': 'settings.exchangeRates',
}

export default function Header() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  // Match longest prefix first so sub-routes get specific titles
  const key = Object.keys(titleMap)
    .filter((k) => pathname === k || (k !== '/' && pathname.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0]

  const title = key ? t(titleMap[key]) : 'ExpenseTracking'

  return (
    <header className="sticky top-0 z-40 flex items-center h-14 px-4 bg-white border-b">
      <NavLink to="/" className="font-semibold text-lg tracking-tight text-gray-900">
        {title}
      </NavLink>
    </header>
  )
}
