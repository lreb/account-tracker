import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Cloud, LogIn } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import {
  getGoogleDriveAccountProfile,
  isGoogleDriveConfigured,
  isSignedInToGoogle,
  startGoogleSignIn,
  type GoogleDriveAccountProfile,
} from '@/lib/google-drive'

interface SidebarGoogleAuthSectionProps {
  onClose: () => void
}

export default function SidebarGoogleAuthSection({ onClose }: SidebarGoogleAuthSectionProps) {
  const { t } = useTranslation()
  const { googleClientId } = useSettingsStore()
  const [profile, setProfile] = useState<GoogleDriveAccountProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const driveSignedIn = isSignedInToGoogle()
  const driveConfigured = isGoogleDriveConfigured(googleClientId)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!driveSignedIn) {
        setProfile(null)
        setLoadingProfile(false)
        return
      }

      setLoadingProfile(true)
      try {
        const accountProfile = await getGoogleDriveAccountProfile()
        if (!cancelled) setProfile(accountProfile)
      } catch (err) {
        console.error(err)
        if (!cancelled) setProfile(null)
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [driveSignedIn])

  const handleConnect = () => {
    if (!driveConfigured) {
      toast.error(t('settings.driveNotConfigured'))
      return
    }

    try {
      onClose()
      startGoogleSignIn(googleClientId, '/settings/google-drive')
    } catch (err) {
      console.error(err)
      toast.error(t('settings.driveConnectFailed'))
    }
  }

  if (!driveSignedIn) {
    return (
      <section className="mx-3 mt-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-white p-2 text-gray-500 shadow-sm ring-1 ring-gray-200">
            <Cloud size={16} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('sidebar.googleAuthTitle')}
            </p>
            <p className="text-xs text-gray-600">
              {t('sidebar.googleAuthLoginPrompt')}
            </p>
            <button
              type="button"
              onClick={handleConnect}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              <LogIn size={14} />
              {t('sidebar.googleAuthLoginAction')}
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-3 mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {t('sidebar.googleAuthConnected')}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {profile?.pictureUrl ? (
          <img
            src={profile.pictureUrl}
            alt={t('sidebar.googleAuthImageAlt')}
            className="h-10 w-10 rounded-full border border-emerald-200 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-10 w-10 rounded-full border border-emerald-200 bg-white" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-emerald-900">
            {loadingProfile ? t('common.loading') : (profile?.name ?? t('sidebar.googleAuthFallbackName'))}
          </p>
          <p className="truncate text-xs text-emerald-800/80">
            {loadingProfile ? '' : (profile?.email ?? t('sidebar.googleAuthFallbackEmail'))}
          </p>
        </div>
      </div>
    </section>
  )
}
