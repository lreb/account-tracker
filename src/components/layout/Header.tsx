import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'

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
  '/settings/import-export':  'settings.importExportTitle',
  '/settings/google-drive':   'settings.googleDriveTitle',
  '/settings/data-retention': 'settings.dataRetentionTitle',
  '/settings/preferences':    'settings.preferencesTitle',
}

interface HeaderProps {
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  // Match longest prefix first so sub-routes get specific titles
  const key = Object.keys(titleMap)
    .filter((k) => pathname === k || (k !== '/' && pathname.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0]

  const title = key ? t(titleMap[key]) : 'ExpenseTracking'

  return (
    <header className="sticky top-0 z-40 flex items-center h-14 px-4 bg-white border-b gap-3">
      <button
        type="button"
        onClick={onMenuToggle}
        className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label="Menu"
      >
        <Menu size={22} />
      </button>
      <NavLink to="/" className="font-semibold text-lg tracking-tight text-gray-900">
        {title}
      </NavLink>
    </header>
  )
}
