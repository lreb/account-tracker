import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, Wallet, Tag, RefreshCw, Download, Upload } from 'lucide-react'

const settingsItems = [
  { to: '/settings/accounts',       icon: Wallet,    labelKey: 'settings.accounts' },
  { to: '/settings/categories',     icon: Tag,       labelKey: 'settings.categories' },
  { to: '/settings/labels',         icon: Tag,       labelKey: 'settings.labels' },
  { to: '/settings/exchange-rates', icon: RefreshCw, labelKey: 'settings.exchangeRates' },
] as const

const dataItems = [
  { icon: Download, labelKey: 'settings.exportData' },
  { icon: Upload,   labelKey: 'settings.importData' },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      <div className="rounded-2xl border divide-y overflow-hidden bg-white">
        {settingsItems.map(({ to, icon: Icon, labelKey }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <Icon size={18} className="text-gray-500 shrink-0" />
            <span className="flex-1 text-sm font-medium">{t(labelKey)}</span>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border divide-y overflow-hidden bg-white">
        {dataItems.map(({ icon: Icon, labelKey }) => (
          <button
            key={labelKey}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <Icon size={18} className="text-gray-500 shrink-0" />
            <span className="flex-1 text-left text-sm font-medium">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
