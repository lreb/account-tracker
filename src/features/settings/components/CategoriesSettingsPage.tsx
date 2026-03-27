import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { Pencil, Trash2, Plus, RotateCcw } from 'lucide-react'

import { categorySchema, type CategoryFormValues } from '../schemas/category.schema'
import { useCategoriesStore } from '@/stores/categories.store'
import { ICON_MAP, CategoryIcon } from '@/lib/icon-map'
import { getTranslatedCategoryName } from '@/lib/categories'
import type { Category, CategoryType } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const ICON_NAMES = Object.keys(ICON_MAP)
const CATEGORY_TYPES: CategoryType[] = ['expense', 'income', 'any']

/* ─── Category form dialog (create / edit) ───────────────────────── */

function CategoryDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Category
}) {
  const { t } = useTranslation()
  const { add, update } = useCategoriesStore()
  const isEdit = Boolean(editing)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: editing
      ? { name: editing.name, icon: editing.icon, type: editing.type }
      : { name: '', icon: 'MoreHorizontal', type: 'expense' },
  })

  const watchType = watch('type')

  // Re-populate form every time the dialog opens (or when editing changes while open).
  // Including `open` in deps is critical: if the user cancels without saving then
  // reopens the same category, `editing` reference is unchanged so the effect would
  // not fire without `open` — leaving the form with whatever the user had typed.
  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({ name: editing.name, icon: editing.icon, type: editing.type })
    } else {
      reset({ name: '', icon: 'MoreHorizontal', type: 'expense' })
    }
  }, [open, editing, reset])

  const onSubmit = async (values: CategoryFormValues) => {
    if (isEdit && editing) {
      await update({ ...editing, name: values.name, icon: values.icon, type: values.type })
    } else {
      await add({ id: uuid(), name: values.name, icon: values.icon, isCustom: true, type: values.type })
    }
    reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) { reset(); onClose() }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('categories.editCategory') : t('categories.newCategory')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="catName">{t('categories.categoryName')}</Label>
            <Input id="catName" placeholder={t('categories.namePlaceholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
          </div>

          {/* Type selector */}
          <div className="space-y-1">
            <Label>{t('categories.type')}</Label>
            <Select value={watchType} onValueChange={(v) => setValue('type', v as CategoryType)}>
              <SelectTrigger>
                <SelectValue>
                  {t(`categories.types.${watchType}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {t(`categories.types.${ct}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon picker */}
          <div className="space-y-1">
            <Label>{t('categories.icon')}</Label>
            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto rounded-lg border p-2">
                  {ICON_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => field.onChange(name)}
                      title={name}
                      className={`flex items-center justify-center rounded p-1.5 transition-colors ${
                        field.value === name
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <CategoryIcon name={name} size={16} />
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.icon && <p className="text-xs text-red-500">{t(errors.icon.message!)}</p>}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Section for one category-type group ────────────────────────── */

function CategorySection({
  type,
  items,
  onEdit,
  onRemove,
  onRestore,
  t,
}: {
  type: CategoryType
  items: Category[]
  onEdit: (c: Category) => void
  onRemove: (id: string) => void
  onRestore: (id: string) => void
  t: (k: string) => string
}) {
  const sortByName = (a: Category, b: Category) =>
    getTranslatedCategoryName(a, t).localeCompare(getTranslatedCategoryName(b, t))

  const active   = items.filter((c) => !c.deletedAt).sort(sortByName)
  const archived = items.filter((c) =>  !!c.deletedAt).sort(sortByName)

  if (active.length === 0 && archived.length === 0) return null

  const sectionColors: Record<CategoryType, string> = {
    expense: 'text-red-600',
    income:  'text-green-600',
    any:     'text-gray-500',
  }

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
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
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{getTranslatedCategoryName(cat, t)}</span>
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
              className="h-8 w-8 text-red-400 hover:text-red-600"
              onClick={() => onRemove(cat.id)}
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
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
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-500 truncate line-through">
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
    </section>
  )
}

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
