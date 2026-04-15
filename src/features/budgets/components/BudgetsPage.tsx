import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  isSameMonth,
} from 'date-fns'
import { Plus, PiggyBank, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

import { useBudgetsStore } from '@/stores/budgets.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { getTranslatedCategoryName } from '@/lib/categories'
import type { Budget } from '@/types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'

import { MonthPickerDialog } from './MonthPickerDialog'
import { BudgetCard } from './BudgetCard'
import { BudgetDialog } from './BudgetDialog'
import { CategoryFilterBar } from './CategoryFilterBar'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { t } = useTranslation()
  const { budgets, remove } = useBudgetsStore()
  const { categories } = useCategoriesStore()
  useAccountsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [referenceDate, setReferenceDate] = useState<Date>(() => startOfMonth(new Date()))
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const today = new Date()
  const isCurrentMonth = isSameMonth(referenceDate, today)

  // Only show categories that have at least one budget
  const budgetCategories = useMemo(
    () => categories.filter((c) => budgets.some((b) => b.categoryId === c.id)),
    [categories, budgets],
  )

  const filteredBudgets = useMemo(() => {
    const list = filterCategoryIds.length === 0
      ? budgets
      : budgets.filter((b) => filterCategoryIds.includes(b.categoryId))
    return [...list].sort((a, b) => {
      const nameA = getTranslatedCategoryName(categories.find((c) => c.id === a.categoryId), t)
      const nameB = getTranslatedCategoryName(categories.find((c) => c.id === b.categoryId), t)
      return nameA.localeCompare(nameB)
    })
  }, [budgets, filterCategoryIds, categories, t])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (b: Budget) => { setEditing(b); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }
  const confirmDelete = (id: string) => setDeletingId(id)
  const handleDeleteConfirmed = async () => {
    if (deletingId) await remove(deletingId)
    setDeletingId(null)
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setReferenceDate((d) => startOfMonth(subMonths(d, 1)))}
          className="rounded-full p-1.5 hover:bg-gray-100"
          aria-label={t('budgets.prevMonth')}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => setMonthPickerOpen(true)}
          className="flex items-center gap-1 rounded-full px-3 py-1 hover:bg-gray-100 transition-colors"
        >
          <span className="text-base font-bold">
            {format(referenceDate, 'MMMM yyyy')}
          </span>
          <ChevronDown size={14} className="text-gray-500" />
        </button>

        <button
          type="button"
          onClick={() => setReferenceDate((d) => startOfMonth(addMonths(d, 1)))}
          disabled={isCurrentMonth}
          className="rounded-full p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t('budgets.nextMonth')}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Category filter chips */}
      {budgetCategories.length > 1 && (
        <CategoryFilterBar
          categories={budgetCategories}
          selected={filterCategoryIds}
          onChange={setFilterCategoryIds}
        />
      )}

      {/* Budget list */}
      {budgets.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <PiggyBank size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">{t('budgets.noBudgets')}</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            {t('budgets.createFirstBudget')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredBudgets.map((budget) => (
            <li key={budget.id}>
              <BudgetCard
                budget={budget}
                referenceDate={referenceDate}
                onEdit={openEdit}
                onDelete={confirmDelete}
              />
            </li>
          ))}
        </ul>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={openAdd}
        aria-label={t('budgets.newBudget')}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>

      <BudgetDialog open={dialogOpen} editing={editing} onClose={closeDialog} />

      {/* Delete confirmation dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(v) => { if (!v) setDeletingId(null) }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t('budgets.confirmDeleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">{t('budgets.confirmDeleteMessage')}</p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MonthPickerDialog
        key={monthPickerOpen ? format(referenceDate, 'yyyy-MM') : 'closed'}
        open={monthPickerOpen}
        current={referenceDate}
        onSelect={setReferenceDate}
        onClose={() => setMonthPickerOpen(false)}
      />
      <ScrollToTopButton />
    </div>
  )
}
