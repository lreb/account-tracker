import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator, Delete } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CalculatorOperator = '+' | '-' | '*' | '/'

type CalcState = {
  display: string
  storedValue: number | null
  operator: CalculatorOperator | null
  waitingNext: boolean
}

const INIT_CALC_STATE: CalcState = {
  display: '0',
  storedValue: null,
  operator: null,
  waitingNext: false,
}

type AmountCalculatorButtonProps = {
  currentValue?: string
  onApply: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function AmountCalculatorButton({
  currentValue,
  onApply,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: AmountCalculatorButtonProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const [calc, setCalc] = useState<CalcState>(INIT_CALC_STATE)
  const { display, storedValue, operator, waitingNext } = calc

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (value: boolean) => {
    if (!isControlled) setInternalOpen(value)
    onOpenChange?.(value)
  }

  // Track the previous isOpen value as state so we can detect the closed→open
  // transition during render. This is the React-recommended pattern for resetting
  // derived state when a prop/value changes (no useEffect, no ref during render).
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      const parsed = currentValue ? parseFloat(currentValue) : NaN
      setCalc(!isNaN(parsed) && isFinite(parsed)
        ? { display: parsed.toString(), storedValue: null, operator: null, waitingNext: true }
        : INIT_CALC_STATE
      )
    }
  }

  const reset = () => setCalc(INIT_CALC_STATE)

  const openCalculator = () => {
    handleOpenChange(true)
  }

  const inputDigit = (digit: string) => {
    if (waitingNext) {
      setCalc((prev) => ({ ...prev, display: digit, waitingNext: false }))
      return
    }
    setCalc((prev) => ({ ...prev, display: prev.display === '0' ? digit : `${prev.display}${digit}` }))
  }

  const inputDecimal = () => {
    if (waitingNext) {
      setCalc((prev) => ({ ...prev, display: '0.', waitingNext: false }))
      return
    }
    setCalc((prev) => ({ ...prev, display: prev.display.includes('.') ? prev.display : `${prev.display}.` }))
  }

  const calculate = (left: number, right: number, op: CalculatorOperator): number => {
    if (op === '+') return left + right
    if (op === '-') return left - right
    if (op === '*') return left * right
    if (right === 0) return 0
    return left / right
  }

  const applyOperator = (nextOperator: CalculatorOperator) => {
    const inputValue = parseFloat(display)
    if (isNaN(inputValue)) {
      return
    }

    if (storedValue === null) {
      setCalc((prev) => ({ ...prev, storedValue: inputValue, operator: nextOperator, waitingNext: true }))
      return
    }

    if (operator && !waitingNext) {
      const result = calculate(storedValue, inputValue, operator)
      setCalc((prev) => ({ ...prev, display: result.toString(), storedValue: result, operator: nextOperator, waitingNext: true }))
      return
    }

    setCalc((prev) => ({ ...prev, operator: nextOperator, waitingNext: true }))
  }

  const applyEquals = () => {
    if (!operator || storedValue === null) {
      return
    }
    const inputValue = parseFloat(display)
    if (isNaN(inputValue)) {
      return
    }
    const result = calculate(storedValue, inputValue, operator)
    setCalc({ display: result.toString(), storedValue: null, operator: null, waitingNext: true })
  }

  const backspace = () => {
    if (waitingNext) {
      setCalc((prev) => ({ ...prev, display: '0', waitingNext: false }))
      return
    }
    setCalc((prev) => {
      const d = prev.display
      const next = d.length <= 1 ? '0' : (d.startsWith('-') && d.length === 2 ? '0' : d.slice(0, -1))
      return { ...prev, display: next }
    })
  }

  const handleApply = () => {
    // Resolve any pending operator (OK acts like = before applying)
    let result = parseFloat(display)
    if (operator && storedValue !== null && !waitingNext) {
      result = calculate(storedValue, result, operator)
    } else if (operator && storedValue !== null && waitingNext) {
      result = storedValue
    }

    if (isNaN(result) || !isFinite(result) || result <= 0) {
      onApply('')
      handleOpenChange(false)
      return
    }

    onApply(result.toFixed(2))
    handleOpenChange(false)
  }

  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={openCalculator}
          aria-label={t('transactions.calculator.open', 'Open calculator')}
          title={t('transactions.calculator.open', 'Open calculator')}
        >
          <Calculator />
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xs p-0" showCloseButton={false}>
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>{t('transactions.calculator.title', 'Amount Calculator')}</DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4 pt-3 space-y-3">
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-right text-xl font-semibold tracking-wide">
              {display}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={reset}>
                {t('transactions.calculator.clear', 'C')}
              </Button>
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={backspace} aria-label={t('transactions.calculator.backspace', 'Backspace')}>
                <Delete className="size-5" />
              </Button>
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={() => applyOperator('/')}>/</Button>
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={() => applyOperator('*')}>×</Button>

              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('7')}>7</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('8')}>8</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('9')}>9</Button>
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={() => applyOperator('-')}>−</Button>

              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('4')}>4</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('5')}>5</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('6')}>6</Button>
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={() => applyOperator('+')}>+</Button>

              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('1')}>1</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('2')}>2</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('3')}>3</Button>
              <Button type="button" variant="secondary" className="h-14 text-lg" onClick={applyEquals}>=</Button>

              <Button type="button" variant="outline" className="col-span-2 h-14 text-lg" onClick={() => inputDigit('0')}>0</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={inputDecimal}>.</Button>
              <Button type="button" variant="outline" className="h-14 text-lg" onClick={() => inputDigit('00')}>00</Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-14 text-lg" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" className="flex-1 h-14 text-lg" onClick={handleApply}>
                {t('transactions.calculator.ok', 'OK')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
