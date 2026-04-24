import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { useCategoriesStore } from '@/stores/categories.store'
import type { Category, CategoryType } from '@/types'

import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import CategoryDialog from './CategoryDialog'
import CategorySection from './CategorySection'

const CATEGORY_TYPES: CategoryType[] = ['expense', 'income', 'any']
/* ─── Page ────────────────────────────────────────────────────────── */

export default function CategoriesSettingsPage() {
  const { t } = useTranslation()
  const { categories, remove, restore } = useCategoriesStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | undefined>()

  const grouped = useMemo(() => {
    const map: Record<CategoryType, Category[]> = { expense: [], income: [], any: [] }
    for (const cat of categories) {
      map[cat.type]?.push(cat)
    }
    return map
  }, [categories])

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setEditing(undefined)
    setDialogOpen(false)
  }

  return (
    <div className="p-4 pb-24">
      <div className="mb-4">
        <h1 className="text-xl font-bold">{t('settings.categories')}</h1>
      </div>

      {CATEGORY_TYPES.map((type) => (
        <CategorySection
          key={type}
          type={type}
          items={grouped[type]}
          onEdit={openEdit}
          onRemove={remove}
          onRestore={restore}
          t={t}
        />
      ))}

      <CategoryDialog open={dialogOpen} onClose={closeDialog} editing={editing} />

      {/* Floating add button */}
      <button
        type="button"
        onClick={openCreate}
        aria-label={t('common.add')}
        title={t('common.add')}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 active:scale-95 transition-all"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <ScrollToTopButton />
    </div>
  )
}
