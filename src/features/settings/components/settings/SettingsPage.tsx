import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ChevronRight, Download, CloudUpload, Clock, Globe,
  Smartphone, CheckCircle2, Share, BotMessageSquare,
} from 'lucide-react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const settingsItems = [
  { to: '/settings/preferences',    icon: Globe,              labelKey: 'settings.preferencesTitle' },
  { to: '/settings/import-export',  icon: Download,           labelKey: 'settings.importExportTitle' },
  { to: '/settings/google-drive',   icon: CloudUpload,        labelKey: 'settings.googleDriveTitle' },
  { to: '/settings/data-retention', icon: Clock,              labelKey: 'settings.dataRetentionTitle' },
  { to: '/settings/ai-assistant',   icon: BotMessageSquare,   labelKey: 'settings.aiAssistantTitle' },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      {/* PWA Install Section */}
      <div className="rounded-2xl border overflow-hidden bg-white">
        {isInstalled ? (
          <div className="flex items-start gap-3 px-4 py-4">
            <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t('settings.installAppInstalledTitle')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('settings.installAppInstalledDesc')}</p>
            </div>
          </div>
        ) : isInstallable ? (
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <Smartphone size={20} className="text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('settings.installApp')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.installAppDesc')}</p>
              </div>
            </div>
            <button
              onClick={() => { void install() }}
              className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 px-4 transition-opacity hover:opacity-90 active:opacity-80"
            >
              {t('settings.installAppBtn')}
            </button>
          </div>
        ) : isIOS ? (
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <Smartphone size={20} className="text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t('settings.installApp')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.installAppIOSTitle')}</p>
              </div>
            </div>
            <ol className="space-y-2 pl-1">
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">1</span>
                <span>{t('settings.installAppIOSStep1')}</span>
                <Share size={14} className="shrink-0 text-gray-400" />
              </li>
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">2</span>
                <span>{t('settings.installAppIOSStep2')}</span>
              </li>
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">3</span>
                <span>{t('settings.installAppIOSStep3')}</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 py-4">
            <Smartphone size={20} className="text-gray-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t('settings.installApp')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('settings.installAppBrowserHint')}</p>
            </div>
          </div>
        )}
      </div>

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

