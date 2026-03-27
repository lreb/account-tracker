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

type AmountCalculatorButtonProps = {
  currentValue?: string
  onApply: (value: string) => void
}

export function AmountCalculatorButton({ currentValue, onApply }: AmountCalculatorButtonProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [storedValue, setStoredValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<CalculatorOperator | null>(null)
  const [waitingNext, setWaitingNext] = useState(false)

  const reset = () => {
    setDisplay('0')
    setStoredValue(null)
    setOperator(null)
    setWaitingNext(false)
  }

  const openCalculator = () => {
    const parsed = currentValue ? parseFloat(currentValue) : NaN
    if (!isNaN(parsed) && isFinite(parsed)) {
      setDisplay(parsed.toString())
      setStoredValue(null)
      setOperator(null)
      setWaitingNext(false)
    } else {
      reset()
    }
    setIsOpen(true)
  }

  const inputDigit = (digit: string) => {
    if (waitingNext) {
      setDisplay(digit)
      setWaitingNext(false)
      return
    }
    setDisplay((prev) => (prev === '0' ? digit : `${prev}${digit}`))
  }

  const inputDecimal = () => {
    if (waitingNext) {
      setDisplay('0.')
      setWaitingNext(false)
      return
    }
    setDisplay((prev) => (prev.includes('.') ? prev : `${prev}.`))
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
      setStoredValue(inputValue)
      setOperator(nextOperator)
      setWaitingNext(true)
      return
    }

    if (operator && !waitingNext) {
      const result = calculate(storedValue, inputValue, operator)
      setDisplay(result.toString())
      setStoredValue(result)
    }

    setOperator(nextOperator)
    setWaitingNext(true)
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
    setDisplay(result.toString())
    setStoredValue(null)
    setOperator(null)
    setWaitingNext(true)
  }

  const backspace = () => {
    if (waitingNext) {
      setDisplay('0')
      setWaitingNext(false)
      return
    }
    setDisplay((prev) => {
      if (prev.length <= 1) return '0'
      if (prev.startsWith('-') && prev.length === 2) return '0'
      return prev.slice(0, -1)
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
      setIsOpen(false)
      return
    }

    onApply(result.toFixed(2))
    setIsOpen(false)
  }

  return (
    <>
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xs p-0" showCloseButton={false}>
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>{t('transactions.calculator.title', 'Amount Calculator')}</DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4 pt-3 space-y-3">
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-right text-xl font-semibold tracking-wide">
              {display}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={reset}>
                {t('transactions.calculator.clear', 'C')}
              </Button>
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={backspace} aria-label={t('transactions.calculator.backspace', 'Backspace')}>
                <Delete className="size-5" />
              </Button>
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => applyOperator('/')}>/</Button>
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => applyOperator('*')}>×</Button>

              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('7')}>7</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('8')}>8</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('9')}>9</Button>
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => applyOperator('-')}>−</Button>

              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('4')}>4</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('5')}>5</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('6')}>6</Button>
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => applyOperator('+')}>+</Button>

              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('1')}>1</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('2')}>2</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('3')}>3</Button>
              <Button type="button" variant="secondary" className="h-12 text-base" onClick={applyEquals}>=</Button>

              <Button type="button" variant="outline" className="col-span-2 h-12 text-base" onClick={() => inputDigit('0')}>0</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={inputDecimal}>.</Button>
              <Button type="button" variant="outline" className="h-12 text-base" onClick={() => inputDigit('00')}>00</Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 h-12 text-base" onClick={() => setIsOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" className="flex-1 h-12 text-base" onClick={handleApply}>
                {t('transactions.calculator.ok', 'OK')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
