import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { CalendarClock, CheckCheck, SkipForward } from 'lucide-react'

import { useRecurringTransactionsStore } from '@/stores/recurring-transactions.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getDueRecurring, advanceDueDate } from '@/lib/recurring-transactions'
import { formatCurrency } from '@/lib/currency'
import type { RecurringTransaction, Transaction } from '@/types'

export default function DueRemindersSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { recurringTransactions, load, update: updateReminder } = useRecurringTransactionsStore()
  const { add: addTransaction } = useTransactionsStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()

  useEffect(() => {
    load()
  }, [load])

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const dueItems   = useMemo(() => getDueRecurring(recurringTransactions), [recurringTransactions])

  if (dueItems.length === 0) return null

  async function applyReminder(r: RecurringTransaction) {
    // Build the transaction from the template
    const isoDate = new Date(`${r.nextDueDate}T${r.time}:00`).toISOString()
    const tx: Transaction = {
      id:              uuid(),
      type:            r.type,
      amount:          r.amount,
      date:            isoDate,
      categoryId:      r.categoryId,
      accountId:       r.accountId,
      toAccountId:     r.toAccountId,
      description:     r.description,
      notes:           r.notes,
      status:          r.status,
      labels:          r.labels,
      currency:        r.currency,
      exchangeRate:    r.exchangeRate,
    }
    await addTransaction(tx)
    await advanceReminder(r)
  }

  async function skipReminder(r: RecurringTransaction) {
    await advanceReminder(r)
  }

  async function advanceReminder(r: RecurringTransaction) {
    const fired      = r.occurrencesFired + 1
    const completed  = fired >= r.totalOccurrences
    const nextDue    = completed ? r.nextDueDate : advanceDueDate(r.nextDueDate, r.interval)

    await updateReminder({
      ...r,
      occurrencesFired: fired,
      nextDueDate:      nextDue,
      active:           !completed,
    })
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-amber-700">
          <CalendarClock size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('reminders.dueRemindersTitle', { count: dueItems.length })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reminders')}
          className="text-xs text-amber-700 hover:underline"
        >
          {t('reminders.viewAll')}
        </button>
      </div>

      {dueItems.map((r) => {
        const account = accountMap.get(r.accountId)
        const remaining = r.totalOccurrences - r.occurrencesFired

        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(r.amount, account?.currency ?? baseCurrency)}
                {' · '}
                {t('reminders.remainingOccurrences', { count: remaining })}
                {' · '}
                {format(parseISO(r.nextDueDate), 'MMM d')}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Skip — advances without creating a transaction */}
              <button
                type="button"
                onClick={() => skipReminder(r)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title={t('reminders.skip')}
                aria-label={t('reminders.skip')}
              >
                <SkipForward size={15} />
              </button>

              {/* Apply — creates a transaction and advances */}
              <button
                type="button"
                onClick={() => applyReminder(r)}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <CheckCheck size={13} />
                {t('reminders.apply')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
