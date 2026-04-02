import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const KM_TO_MI = 0.621371
const MI_TO_KM = 1.60934

type Direction = 'kmToMi' | 'miToKm'

type OdometerConverterButtonProps = {
  currentValue?: string
  onApply: (value: string) => void
}

export function OdometerConverterButton({ currentValue, onApply }: OdometerConverterButtonProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [direction, setDirection] = useState<Direction>('kmToMi')
  const [input, setInput] = useState('')

  const open = () => {
    const parsed = currentValue ? parseInt(currentValue, 10) : NaN
    setInput(!isNaN(parsed) && parsed > 0 ? parsed.toString() : '')
    setIsOpen(true)
  }

  const inputNum = parseInt(input, 10)
  const isValid = !isNaN(inputNum) && inputNum > 0

  const converted = isValid
    ? direction === 'kmToMi'
      ? Math.round(inputNum * KM_TO_MI)
      : Math.round(inputNum * MI_TO_KM)
    : null

  const handleApply = () => {
    if (converted === null) return
    onApply(converted.toString())
    setIsOpen(false)
  }

  const fromUnit = direction === 'kmToMi' ? t('vehicles.km') : t('vehicles.mi')
  const toUnit = direction === 'kmToMi' ? t('vehicles.mi') : t('vehicles.km')

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={open}
        aria-label={t('vehicles.odometerConverter.open')}
        title={t('vehicles.odometerConverter.open')}
      >
        <ArrowLeftRight className="size-3.5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t('vehicles.odometerConverter.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Direction toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  direction === 'kmToMi'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setDirection('kmToMi')}
              >
                km → mi
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  direction === 'miToKm'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setDirection('miToKm')}
              >
                mi → km
              </button>
            </div>

            {/* Input */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500">{t('vehicles.odometerConverter.from', { unit: fromUnit })}</p>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
            </div>

            {/* Result */}
            <div className="rounded-lg border bg-muted/40 px-3 py-3 space-y-0.5">
              <p className="text-xs text-gray-500">{t('vehicles.odometerConverter.result', { unit: toUnit })}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {converted !== null ? converted.toLocaleString() : '—'}
              </p>
              {converted !== null && (
                <p className="text-xs text-gray-400">
                  {inputNum.toLocaleString()} {fromUnit} = {converted.toLocaleString()} {toUnit}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={converted === null}
                onClick={handleApply}
              >
                {t('vehicles.odometerConverter.apply', { value: converted?.toLocaleString() ?? '—', unit: toUnit })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
