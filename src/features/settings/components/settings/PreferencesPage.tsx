import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Globe, ArrowLeft } from 'lucide-react'
import i18n from '@/i18n'

import { useSettingsStore } from '@/stores/settings.store'
import { COMMON_CURRENCIES } from '@/constants/currencies'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function PreferencesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { saveSetting, language, baseCurrency } = useSettingsStore()

  async function handleLanguageChange(lang: string) {
    await saveSetting('language', lang)
    await i18n.changeLanguage(lang)
  }

  async function handleBaseCurrencyChange(currency: string) {
    const nextCurrency = (currency || 'USD').toUpperCase()
    await saveSetting('baseCurrency', nextCurrency)
    toast.success(t('common.saved'))
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          aria-label={t('common.back', { defaultValue: 'Back' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">{t('settings.preferencesTitle')}</h1>
      </div>

      {/* ── Language section ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.sectionLanguage')}</p>
        <div className="rounded-2xl border divide-y overflow-hidden bg-white">
          {(['en', 'es'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <Globe size={18} className="text-gray-500 shrink-0" />
              <span className="flex-1 text-left text-sm font-medium">
                {lang === 'en' ? t('settings.languageEnglish') : t('settings.languageSpanish')}
              </span>
              {language === lang && (
                <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Base currency section ───────────────────────────────────────── */}
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">{t('settings.baseCurrency')}</p>
        <div className="rounded-2xl border overflow-hidden bg-white p-3">
          <Select
            value={baseCurrency || 'USD'}
            onValueChange={(v) => { void handleBaseCurrencyChange(v ?? 'USD') }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CURRENCIES.map(({ code, label }) => (
                <SelectItem key={code} value={code}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
