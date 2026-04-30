import { useState } from 'react'
import { Calculator } from 'lucide-react'
import type React from 'react'

import { AmountCalculatorButton } from '@/components/ui/amount-calculator-button'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

type AmountInputProps = {
  /** Field label rendered above the input */
  label: string
  /** Current string value from watch(fieldName) — e.g. "12.50" */
  value?: string
  /** ISO 4217 currency code used for formatted display */
  currency: string
  /** Translated error message; when set the border turns red */
  error?: string
  /** Called with "12.50"-style string when the calculator confirms */
  onApply: (value: string) => void
  /**
   * Props spread onto the hidden <input> to register the field with
   * react-hook-form. Pass the result of register(fieldName[, options]).
   */
  registerProps?: React.InputHTMLAttributes<HTMLInputElement>
  /** Extra class names for the outer wrapper div */
  className?: string
}

export function AmountInput({
  label,
  value,
  currency,
  error,
  onApply,
  registerProps,
  className,
}: AmountInputProps) {
  const [open, setOpen] = useState(false)

  const numericValue = value ? parseFloat(value) : NaN
  const hasValue = !isNaN(numericValue) && numericValue > 0

  return (
    <div className={cn('space-y-1', className)}>
      <Label>{label}</Label>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'h-8 w-full flex items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors',
          'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'hover:border-ring/50 md:text-sm',
          error ? 'border-destructive ring-3 ring-destructive/20' : 'border-input',
        )}
      >
        <span className={hasValue ? 'tabular-nums' : 'text-muted-foreground'}>
          {hasValue
            ? formatCurrency(Math.round(numericValue * 100), currency)
            : '0.00'}
        </span>
        <Calculator className="size-4 text-muted-foreground shrink-0" />
      </button>

      {registerProps && <input type="hidden" {...registerProps} />}

      <AmountCalculatorButton
        currentValue={value}
        onApply={onApply}
        open={open}
        onOpenChange={setOpen}
        hideTrigger
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
