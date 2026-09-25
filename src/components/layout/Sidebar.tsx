import { useEffect, useState } from 'react'
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
  Wallet,
  Tag,
  RefreshCw,
  X,
  Bell,
  TrendingUp,
  Download,
  CloudUpload,
  Info,
} from 'lucide-react'
import { useVehiclesStore } from '@/stores/vehicles.store'
import SidebarGoogleAuthSection from './SidebarGoogleAuthSection'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CREATOR_NAME = 'Luis Raúl Espinoza Barboza'
const CREATOR_LINKEDIN_URL =
  'https://www.linkedin.com/in/luis-ra%C3%BAl-espinoza-barboza-5b767751/'
const CREATOR_SITE_URL = 'https://www.facware.com'
const CONTACT_EMAIL = 'luis.espinoza@facware.com'
const OFFICIAL_PAGE_URL = 'https://www.facware.com/products/expense-tracking.html'
const LICENSE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html'
const LICENSE_NAME = 'GPL-3.0-only'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const mainItems = [
  { to: '/',              icon: LayoutDashboard, labelKey: 'nav.dashboard',    end: true },
  { to: '/transactions',  icon: ArrowLeftRight,  labelKey: 'nav.transactions', end: false },
  { to: '/vehicles',      icon: Car,             labelKey: 'nav.vehicles',     end: false },
  { to: '/balance-sheet', icon: Scale,           labelKey: 'nav.balanceSheet', end: false },
  { to: '/reports',       icon: BarChart3,       labelKey: 'nav.reports',      end: false },
  { to: '/budgets',       icon: PiggyBank,       labelKey: 'nav.budgets',      end: false },
  { to: '/insights',      icon: Lightbulb,       labelKey: 'nav.insights',     end: false },
  { to: '/reminders',               icon: Bell,        labelKey: 'nav.reminders',        end: false },
  { to: '/tools/compound-interest', icon: TrendingUp,  labelKey: 'nav.compoundInterest', end: false },
] as const

const dataItems = [
  { to: '/settings/import-export', icon: Download,     labelKey: 'settings.importExportTitle', end: false },
  { to: '/settings/google-drive',  icon: CloudUpload,  labelKey: 'settings.googleDriveTitle',  end: false },
] as const

const settingsItems = [
  { to: '/settings/accounts',       icon: Wallet,    labelKey: 'settings.accounts',    end: false },
  { to: '/settings/categories',     icon: Tag,       labelKey: 'settings.categories',  end: false },
  { to: '/settings/labels',         icon: Tag,       labelKey: 'settings.labels',      end: false },
  { to: '/settings/exchange-rates', icon: RefreshCw, labelKey: 'settings.exchangeRates', end: false },
  { to: '/settings',                icon: Settings,  labelKey: 'nav.settings',         end: true  },
] as const

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [aboutOpen, setAboutOpen] = useState(false)
  useVehiclesStore()

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
        <div className="flex items-center justify-between h-14 px-6 border-b shrink-0">
          <div className="flex flex-col gap-0.0 min-w-0">
            <img
              src="/ImagoTipo-1389x256.png"
              alt="ExpenseTracking"
              className="h-12 w-auto max-w-[200px] object-contain"
              loading="eager"
            />
            <span className="text-[10px] text-gray-400 font-mono leading-none">
              v{__APP_VERSION__}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={t('common.cancel')}
          >
            <X size={20} />
          </button>
        </div>

        <SidebarGoogleAuthSection onClose={onClose} />

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

          {/* ── Data ────────────────────────────────────── */}
          <div className="mt-4 px-3 mb-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t('sidebar.data')}
            </p>
          </div>
          <ul className="space-y-0.5 px-3">
            {dataItems.map(({ to, icon: Icon, labelKey, end }) => (
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

          {/* ── Settings shortcuts ──────────────────────── */}
          <div className="mt-4 px-3 mb-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t('sidebar.settings')}
            </p>
          </div>
          <ul className="space-y-0.5 px-3 pb-4">
            {settingsItems.map(({ to, icon: Icon, labelKey, end }) => (
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
            <li>
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Info size={18} className="shrink-0" />
                <span>{t('sidebar.about')}</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* About dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('about.title')}</DialogTitle>
            <DialogDescription>{t('about.description')}</DialogDescription>
          </DialogHeader>
          <img
            src="/ImagoTipo-2778x512.png"
            alt="ExpenseTracking"
            className="h-10 w-auto max-w-full object-contain"
            loading="lazy"
          />
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">{t('about.versionLabel')}</dt>
              <dd className="font-mono">v{__APP_VERSION__}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">{t('about.licenseLabel')}</dt>
              <dd>
                <a
                  href={LICENSE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {LICENSE_NAME}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">{t('about.officialPageLabel')}</dt>
              <dd>
                <a
                  href={OFFICIAL_PAGE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:text-gray-900 break-all"
                >
                  {OFFICIAL_PAGE_URL}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">{t('about.creatorLabel')}</dt>
              <dd>
                <a
                  href={CREATOR_LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {CREATOR_NAME}
                </a>{' '}
                ·{' '}
                <a
                  href={CREATOR_SITE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {CREATOR_SITE_URL}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-500">{t('about.contactLabel')}</dt>
              <dd>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {CONTACT_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
