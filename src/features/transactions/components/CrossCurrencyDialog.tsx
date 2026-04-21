import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import { useExchangeRatesStore } from '@/stores/exchange-rates.store'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface CrossCurrencyResult {
  rate: number            // fromCurrency → toCurrency exchange rate
  destAmountCents: number // calculated destination amount in toCurrency cents
}

interface CrossCurrencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Source account currency (ISO 4217) */
  fromCurrency: string
  /** Destination account currency (ISO 4217) */
  toCurrency: string
  /** Source amount in cents (from the transaction form) */
  sourceAmountCents: number
  /** Pre-fill rate (e.g. from a saved transaction being edited) */
  initialRate?: number
  /** Called when user confirms the exchange rate */
  onConfirm: (result: CrossCurrencyResult) => void
}

export default function CrossCurrencyDialog({
  open,
  onOpenChange,
  fromCurrency,
  toCurrency,
  sourceAmountCents,
  initialRate,
  onConfirm,
}: CrossCurrencyDialogProps) {
  const { t } = useTranslation()
  const { getRateForPair, fetchSinglePairRate } = useExchangeRatesStore()

  const [rateStr, setRateStr] = useState('')
  const [isFetching, setIsFetching] = useState(false)

  // Pre-fill from initialRate or DB cache whenever the dialog opens
  useEffect(() => {
    if (!open) return
    if (initialRate && initialRate > 0) {
      setRateStr(initialRate.toFixed(6))
      return
    }
    const cached = getRateForPair(fromCurrency, toCurrency)
    if (cached !== null) {
      setRateStr(cached.toFixed(6))
    } else {
      setRateStr('')
    }
  }, [open, fromCurrency, toCurrency, initialRate, getRateForPair])

  const rate = parseFloat(rateStr)
  const validRate = !isNaN(rate) && rate > 0
  const destAmountCents = validRate ? Math.round(sourceAmountCents * rate) : 0
  const cachedRate = getRateForPair(fromCurrency, toCurrency)
  const hasDifferentCachedRate = cachedRate !== null && validRate && Math.abs(cachedRate - rate) > 0.000001

  const handleFetchLatest = async () => {
    setIsFetching(true)
    try {
      const fetched = await fetchSinglePairRate(fromCurrency, toCurrency)
      if (fetched !== null) {
        setRateStr(fetched.toFixed(6))
        toast.success(t('crossCurrency.rateUpdated'))
      } else {
        toast.error(t('crossCurrency.fetchFailed'))
      }
    } finally {
      setIsFetching(false)
    }
  }

  const handleConfirm = () => {
    if (!validRate) return
    onConfirm({ rate, destAmountCents })
  }

  const noAmount = sourceAmountCents <= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('crossCurrency.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Currency pair header */}
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="font-mono text-base font-semibold bg-muted rounded px-2.5 py-1">
              {fromCurrency}
            </span>
            <ArrowRight size={16} className="text-muted-foreground" />
            <span className="font-mono text-base font-semibold bg-muted rounded px-2.5 py-1">
              {toCurrency}
            </span>
          </div>

          {/* Conversion preview */}
          <div className="rounded-lg bg-muted/40 border px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('crossCurrency.source')}</span>
              {noAmount ? (
                <span className="text-muted-foreground italic text-xs">{t('crossCurrency.enterAmountFirst')}</span>
              ) : (
                <span className="font-semibold">{formatCurrency(sourceAmountCents, fromCurrency)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('crossCurrency.destination')}</span>
              <span className={`font-semibold ${!validRate || noAmount ? 'text-muted-foreground' : ''}`}>
                {validRate && !noAmount ? formatCurrency(destAmountCents, toCurrency) : '—'}
              </span>
            </div>
          </div>

          {/* Rate input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="shrink-0">
                {t('crossCurrency.rateLabel', { from: fromCurrency, to: toCurrency })}
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs shrink-0"
                onClick={handleFetchLatest}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                {t('crossCurrency.fetchLatest')}
              </Button>
            </div>
            <Input
              type="number"
              step="0.000001"
              inputMode="decimal"
              value={rateStr}
              onChange={(e) => setRateStr(e.target.value)}
              placeholder="1.000000"
            />
            <p className="text-xs text-muted-foreground">
              {t('crossCurrency.rateHint', { from: fromCurrency, to: toCurrency })}
            </p>
            {hasDifferentCachedRate && (
              <button
                type="button"
                onClick={() => setRateStr(cachedRate!.toFixed(6))}
                className="text-xs text-indigo-600 hover:underline"
              >
                {t('crossCurrency.useCached', { rate: cachedRate!.toFixed(4) })}
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!validRate || noAmount}
            onClick={handleConfirm}
          >
            {t('common.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
