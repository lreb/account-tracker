import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import {
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  CheckCircle2,
  PauseCircle,
} from 'lucide-react'

import { useRecurringTransactionsStore } from '@/stores/recurring-transactions.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getDueRecurring, isRecurringCompleted } from '@/lib/recurring-transactions'
import { formatCurrency } from '@/lib/currency'
import { getTranslatedCategoryName } from '@/lib/categories'
import { CategoryIcon } from '@/lib/icon-map'
import type { RecurringTransaction } from '@/types'

export default function RemindersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { recurringTransactions, loading, load, remove } = useRecurringTransactionsStore()
  const { accounts } = useAccountsStore()
  const { categories } = useCategoriesStore()
  const { baseCurrency } = useSettingsStore()

  useEffect(() => {
    load()
  }, [load])

  const accountMap  = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const dueItems       = useMemo(() => getDueRecurring(recurringTransactions), [recurringTransactions])
  const activeItems    = useMemo(
    () => recurringTransactions.filter((r) => r.active && !getDueRecurring([r]).length && !isRecurringCompleted(r)),
    [recurringTransactions],
  )
  const completedItems = useMemo(
    () => recurringTransactions.filter((r) => isRecurringCompleted(r)),
    [recurringTransactions],
  )

  function handleDelete(r: RecurringTransaction) {
    if (!confirm(t('reminders.confirmDelete', { description: r.description }))) return
    remove(r.id)
  }

  function renderCard(r: RecurringTransaction, isDue = false) {
    const account  = accountMap.get(r.accountId)
    const category = categoryMap.get(r.categoryId)

    const progressPct = r.totalOccurrences > 0
      ? Math.min(100, Math.round((r.occurrencesFired / r.totalOccurrences) * 100))
      : 0

    return (
      <div
        key={r.id}
        className={`rounded-xl border p-4 space-y-3 bg-white shadow-sm ${isDue ? 'border-amber-400 bg-amber-50/40' : ''}`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {category?.icon && (
              <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <CategoryIcon name={category.icon} size={16} />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{r.description}</p>
              <p className="text-xs text-muted-foreground truncate">
                {getTranslatedCategoryName(category, t)} · {account?.name ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/reminders/${r.id}`)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label={t('common.edit')}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(r)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label={t('common.delete')}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Amount + interval */}
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(r.amount, account?.currency ?? baseCurrency)}
          </span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {t(`reminders.intervals.${r.interval}`)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('reminders.occurrenceProgress', { fired: r.occurrencesFired, total: r.totalOccurrences })}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Next due date */}
        {!isRecurringCompleted(r) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock size={13} />
            <span>
              {isDue
                ? t('reminders.dueNow')
                : t('reminders.nextDue', { date: format(parseISO(r.nextDueDate), 'MMM d, yyyy') })}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{t('common.loading')}</p>
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('reminders.title')}</h1>
        <button
          type="button"
          onClick={() => navigate('/reminders/new')}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          {t('reminders.new')}
        </button>
      </div>

      {recurringTransactions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <CalendarClock size={40} className="mx-auto opacity-30" />
          <p className="text-sm">{t('reminders.noReminders')}</p>
          <button
            type="button"
            onClick={() => navigate('/reminders/new')}
            className="text-sm text-indigo-600 hover:underline"
          >
            {t('reminders.createFirst')}
          </button>
        </div>
      )}

      {/* Due now */}
      {dueItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-amber-700">{t('reminders.sectionDue')}</h2>
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {dueItems.length}
            </span>
          </div>
          {dueItems.map((r) => renderCard(r, true))}
        </section>
      )}

      {/* Upcoming */}
      {activeItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700">{t('reminders.sectionUpcoming')}</h2>
          </div>
          {activeItems.map((r) => renderCard(r))}
        </section>
      )}

      {/* Completed */}
      {completedItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <h2 className="text-sm font-semibold text-gray-700">{t('reminders.sectionCompleted')}</h2>
          </div>
          {completedItems.map((r) => renderCard(r))}
        </section>
      )}

      {/* Paused (active=false but not completed) */}
      {recurringTransactions
        .filter((r) => !r.active && !isRecurringCompleted(r))
        .map((r) => (
          <section key={r.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <PauseCircle size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500">{t('reminders.sectionPaused')}</h2>
            </div>
            {renderCard(r)}
          </section>
        ))}
    </div>
  )
}
