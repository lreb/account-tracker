import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ChevronRight, Download, CloudUpload, Clock, Globe,
} from 'lucide-react'

const settingsItems = [
  { to: '/settings/preferences',    icon: Globe,       labelKey: 'settings.preferencesTitle' },
  { to: '/settings/import-export',  icon: Download,    labelKey: 'settings.importExportTitle' },
  { to: '/settings/google-drive',   icon: CloudUpload, labelKey: 'settings.googleDriveTitle' },
  { to: '/settings/data-retention', icon: Clock,       labelKey: 'settings.dataRetentionTitle' },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-4 pb-24 space-y-4">
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
    </div>
  )
}

