import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { useCategoriesStore } from '@/stores/categories.store'
import type { Category, CategoryType } from '@/types'

import { Button } from '@/components/ui/button'
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
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('settings.categories')}</h1>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus size={16} />
          {t('common.add')}
        </Button>
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
    </div>
  )
}
