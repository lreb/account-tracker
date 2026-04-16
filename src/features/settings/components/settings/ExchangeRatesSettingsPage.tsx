import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Trash2, RefreshCw, Plus } from 'lucide-react'

import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { useSettingsStore } from '@/stores/settings.store'
import { EXCHANGE_RATE_CURRENCIES } from '@/constants/currencies'

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const manualRateSchema = z.object({
  fromCurrency: z.string().min(3),
  toCurrency:   z.string().min(3),
  rate:         z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be positive'),
  date:         z.string().min(1, 'Date is required'),
})
type ManualRateValues = z.infer<typeof manualRateSchema>

export default function ExchangeRatesSettingsPage() {
  const { t } = useTranslation()
  const { rates, isFetching, load, fetchFromApi, addManual, remove } = useExchangeRatesStore()
  const { baseCurrency, load: loadSettings } = useSettingsStore()

  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadSettings()
    load()
  }, [loadSettings, load])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualRateValues>({
    resolver: zodResolver(manualRateSchema),
    defaultValues: {
      fromCurrency: baseCurrency,
      toCurrency:   '',
      rate:         '',
      date:         format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const watchFrom = watch('fromCurrency')
  const watchTo   = watch('toCurrency')

  const openDialog = () => {
    reset({
      fromCurrency: baseCurrency,
      toCurrency:   '',
      rate:         '',
      date:         format(new Date(), 'yyyy-MM-dd'),
    })
    setDialogOpen(true)
  }

  const onSubmit = async (values: ManualRateValues) => {
    await addManual({
      fromCurrency: values.fromCurrency,
      toCurrency:   values.toCurrency,
      rate:         parseFloat(values.rate),
      date:         values.date,
    })
    setDialogOpen(false)
  }

  // Derive the most-recent date across all rates
  const lastUpdated = rates.length > 0
    ? rates.reduce((latest, r) => (r.date > latest ? r.date : latest), rates[0].date)
    : null

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{t('settings.exchangeRates')}</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('exchangeRates.lastUpdated')}: {lastUpdated}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchFromApi(baseCurrency)}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? t('exchangeRates.fetching') : t('exchangeRates.fetchLatest')}
          </Button>
          <Button size="sm" onClick={openDialog}>
            <Plus className="h-4 w-4 mr-1" />
            {t('exchangeRates.addManual')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('exchangeRates.offlineWarning')}
      </p>

      {/* Rates list */}
      {rates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {t('exchangeRates.noRates')}
        </p>
      ) : (
        <div className="rounded-xl border divide-y bg-card">
          {rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm font-semibold bg-muted rounded px-1.5 py-0.5">
                  {r.fromCurrency}
                </span>
                <span className="text-muted-foreground text-xs">→</span>
                <span className="font-mono text-sm font-semibold bg-muted rounded px-1.5 py-0.5">
                  {r.toCurrency}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium tabular-nums">{r.rate.toFixed(4)}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{r.date}</span>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Manually dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exchangeRates.addRate')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {/* From */}
              <div className="space-y-1">
                <Label>{t('exchangeRates.from')}</Label>
                <Select
                  value={watchFrom || ''}
                  onValueChange={(v) => setValue('fromCurrency', v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="USD" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCHANGE_RATE_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fromCurrency && (
                  <p className="text-xs text-red-500">{t(errors.fromCurrency.message!)}</p>
                )}
              </div>
              {/* To */}
              <div className="space-y-1">
                <Label>{t('exchangeRates.to')}</Label>
                <Select
                  value={watchTo || ''}
                  onValueChange={(v) => setValue('toCurrency', v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="EUR" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCHANGE_RATE_CURRENCIES.filter((c) => c !== watchFrom).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.toCurrency && (
                  <p className="text-xs text-red-500">{t(errors.toCurrency.message!)}</p>
                )}
              </div>
            </div>

            {/* Rate */}
            <div className="space-y-1">
              <Label>{t('exchangeRates.rate')}</Label>
              <Input
                type="number"
                step="0.000001"
                inputMode="decimal"
                placeholder="1.0850"
                {...register('rate')}
              />
              {watchFrom && watchTo && (
                <p className="text-xs text-muted-foreground">
                  {t('exchangeRates.rateHint', { from: watchFrom, to: watchTo })}
                </p>
              )}
              {errors.rate && (
                <p className="text-xs text-red-500">{t(errors.rate.message!)}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1">
              <Label>{t('common.date', 'Date')}</Label>
              <Input type="date" {...register('date')} />
              {errors.date && (
                <p className="text-xs text-red-500">{t(errors.date.message!)}</p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
