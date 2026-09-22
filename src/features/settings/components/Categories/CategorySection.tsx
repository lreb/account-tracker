import { useState } from 'react'
import { Pencil, Archive, RotateCcw } from 'lucide-react'

import { getTranslatedCategoryName, sortCategories } from '@/lib/categories'
import { CategoryIcon } from '@/lib/icon-map'
import type { Category, CategoryType } from '@/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type CategorySectionProps = {
  type: CategoryType
  items: Category[]
  onEdit: (c: Category) => void
  onRemove: (id: string) => void
  onRestore: (id: string) => void
  t: (k: string) => string
}

export default function CategorySection({
  type,
  items,
  onEdit,
  onRemove,
  onRestore,
  t,
}: CategorySectionProps) {
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const active = sortCategories(items.filter((c) => !c.deletedAt), t)
  const archived = sortCategories(items.filter((c) => !!c.deletedAt), t)

  if (active.length === 0 && archived.length === 0) return null

  const sectionColors: Record<CategoryType, string> = {
    expense: 'text-red-600',
    income: 'text-green-600',
    any: 'text-gray-500',
  }

  const handleArchiveClick = (id: string) => {
    setArchivingId(id)
  }

  const handleConfirmArchive = () => {
    if (archivingId) {
      onRemove(archivingId)
      setArchivingId(null)
    }
  }

  const handleCancelArchive = () => {
    setArchivingId(null)
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${sectionColors[type]}`}>
          {t(`categories.types.${type}`)}
        </p>
        <Badge variant="secondary" className="text-[10px]">{active.length}</Badge>
      </div>

      <ul className="space-y-2">
        {active.map((cat) => (
          <li
            key={cat.id}
            className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <CategoryIcon name={cat.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{getTranslatedCategoryName(cat, t)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={() => onEdit(cat)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-400 hover:text-amber-600"
              onClick={() => handleArchiveClick(cat.id)}
            >
              <Archive size={14} />
            </Button>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('categories.archived')} ({archived.length})
          </p>
          <ul className="space-y-2">
            {archived.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed bg-gray-50 px-4 py-3 opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200">
                  <CategoryIcon name={cat.icon} size={18} className="text-gray-400" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-500 line-through">
                  {getTranslatedCategoryName(cat, t)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-500 hover:text-green-700"
                  onClick={() => onRestore(cat.id)}
                  title={t('categories.restore')}
                >
                  <RotateCcw size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!archivingId} onOpenChange={(open) => { if (!open) handleCancelArchive() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('categories.archiveConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('categories.archiveConfirmDesc')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelArchive}>
              {t('common.cancel')}
            </Button>
            <Button variant="secondary" onClick={handleConfirmArchive}>
              {t('categories.archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
