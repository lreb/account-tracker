import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { v4 as uuid } from 'uuid'

import { accountSchema, type AccountFormValues } from '../schemas/account.schema'
import {
  ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE,
  getOtherSubtypeLabelKey,
  getOtherSubtypeValue,
} from '@/constants/account-subtypes'
import { COMMON_CURRENCIES } from '@/constants/currencies'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ACCOUNT_TYPES = ['asset', 'liability'] as const

export default function AccountFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const { accounts, add, update } = useAccountsStore()
  const { baseCurrency, saveSetting } = useSettingsStore()

  const isEditing = Boolean(id)
  const showOnboarding = searchParams.get('onboarding') === '1' && !isEditing
  const editing = useMemo(
    () => (id ? accounts.find((account) => account.id === id) ?? null : null),
    [accounts, id],
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      type: 'asset',
      subtype: '',
      currency: baseCurrency || 'USD',
      hidden: false,
      openingBalance: '0',
      name: '',
    },
  })

  const watchType = watch('type')
  const watchSubtype = watch('subtype') ?? ''
  const subtypeOptions = ACCOUNT_SUBTYPE_OPTIONS_BY_TYPE[watchType]

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        type: editing.type,
        subtype: editing.subtype ?? '',
        currency: editing.currency,
        hidden: editing.hidden ?? false,
        openingBalance: (editing.openingBalance / 100).toFixed(2),
      })
      return
    }

    reset({
      name: '',
      type: 'asset',
      subtype: '',
      currency: baseCurrency || 'USD',
      hidden: false,
      openingBalance: '0',
    })
  }, [editing, reset, baseCurrency])

  useEffect(() => {
    if (isEditing && id && !editing) {
      navigate('/settings/accounts', { replace: true })
    }
  }, [editing, id, isEditing, navigate])

  const onSubmit = async (values: AccountFormValues) => {
    const balanceCents = Math.round(parseFloat(values.openingBalance) * 100)
    const payload = {
      ...values,
      subtype: values.subtype ?? '',
      openingBalance: balanceCents,
    }

    if (editing) {
      await update({ ...editing, ...payload })
    } else {
      await add({ id: uuid(), ...payload })
    }

    if (showOnboarding) {
      await saveSetting('accountsOnboardingSeen', '1')
    }

    navigate('/settings/accounts')
  }

  const handleSkipOnboarding = async () => {
    await saveSetting('accountsOnboardingSeen', '1')
    navigate('/settings/accounts')
  }

  return (
    <div className="p-4 pb-24 max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/settings/accounts')}
        >
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-xl font-bold">
          {editing ? t('common.edit') : t('common.add')} {t('settings.accounts')}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border bg-white p-4">
        {showOnboarding && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-1">
            <p className="font-semibold">{t('accounts.onboardingTitle')}</p>
            <p>{t('accounts.onboardingDesc')}</p>
            <p>{t('accounts.requiredHint')}</p>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="name">{t('accounts.name')} <span className="text-red-500">*</span></Label>
          <Input id="name" placeholder={t('accounts.namePlaceholder')} {...register('name')} />
          {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
        </div>

        <div className="space-y-1">
          <Label>{t('accounts.type')} <span className="text-red-500">*</span></Label>
          <Select
            value={watchType}
            onValueChange={(value) => {
              setValue('type', value as AccountFormValues['type'])
              setValue('subtype', '', { shouldDirty: true })
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {t(`accounts.types.${watchType}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`accounts.types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t('accounts.subtype')}</Label>
          <Select
            value={watchSubtype || getOtherSubtypeValue(watchType)}
            onValueChange={(value) => setValue('subtype', value ?? '', { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue>
                {(() => {
                  const option = subtypeOptions.find((subtype) => subtype.value === watchSubtype)
                  if (option) return t(option.labelKey)
                  return t(getOtherSubtypeLabelKey(watchType))
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {subtypeOptions.map((subtype) => (
                <SelectItem key={subtype.value} value={subtype.value}>
                  {t(subtype.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t('accounts.currency')} <span className="text-red-500">*</span></Label>
          <Select
            value={watch('currency')}
            onValueChange={(value) => setValue('currency', value ?? '')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CURRENCIES.map(({ code, label }) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.currency && <p className="text-xs text-red-500">{t(errors.currency.message!)}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="openingBalance">{t('accounts.openingBalance')}</Label>
          <Input
            id="openingBalance"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            {...register('openingBalance')}
          />
          {errors.openingBalance && (
            <p className="text-xs text-red-500">{t(errors.openingBalance.message!)}</p>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
          <button
            type="button"
            role="switch"
            aria-checked={watch('hidden')}
            onClick={() => setValue('hidden', !watch('hidden'))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              watch('hidden') ? 'bg-gray-900' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                watch('hidden') ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <div className="min-w-0">
            <Label className="cursor-pointer">{t('accounts.hideFromApp')}</Label>
            <p className="text-xs text-gray-500">{t('accounts.excludedFromTotals')}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/settings/accounts')}>
            {t('common.cancel')}
          </Button>
          {showOnboarding && (
            <Button type="button" variant="ghost" onClick={() => { void handleSkipOnboarding() }}>
              {t('accounts.skipTour')}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
