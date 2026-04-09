import { useTranslation } from 'react-i18next'

interface ComputingOverlayProps {
  visible: boolean
}

export function ComputingOverlay({ visible }: ComputingOverlayProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm font-medium text-indigo-700">{t('common.calculating')}</p>
      </div>
    </div>
  )
}
