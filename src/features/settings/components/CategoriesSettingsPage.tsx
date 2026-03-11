import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { Lock, Trash2, Plus } from 'lucide-react'

import { categorySchema, type CategoryFormValues } from '../schemas/category.schema'
import { useCategoriesStore } from '@/stores/categories.store'
import { ICON_MAP, CategoryIcon } from '@/lib/icon-map'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const ICON_NAMES = Object.keys(ICON_MAP)

function AddCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { add } = useCategoriesStore()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', icon: 'MoreHorizontal' },
  })

  const onSubmit = async (values: CategoryFormValues) => {
    await add({ id: uuid(), name: values.name, icon: values.icon, isCustom: true })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="catName">Category Name</Label>
            <Input id="catName" placeholder="e.g. Gym, Pet Care" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
          </div>

          {/* Icon picker */}
          <div className="space-y-1">
            <Label>Icon</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesSettingsPage() {
  const { t } = useTranslation()
  const { categories, remove } = useCategoriesStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  const defaultCats = categories.filter((c) => !c.isCustom)
  const customCats  = categories.filter((c) => c.isCustom)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('settings.categories')}</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {/* Custom categories */}
      {customCats.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Custom</p>
          <ul className="space-y-2">
            {customCats.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <CategoryIcon name={cat.icon} size={18} />
                </span>
                <span className="flex-1 text-sm font-medium">{cat.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => remove(cat.id)}
                >
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Default categories */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Default <Badge variant="secondary" className="ml-1 text-xs">{defaultCats.length}</Badge>
        </p>
        <ul className="space-y-2">
          {defaultCats.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center gap-3 rounded-2xl border bg-gray-50 px-4 py-3 opacity-80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200">
                <CategoryIcon name={cat.icon} size={18} className="text-gray-500" />
              </span>
              <span className="flex-1 text-sm font-medium text-gray-600">{cat.name}</span>
              <Lock size={14} className="text-gray-300" />
            </li>
          ))}
        </ul>
      </section>

      <AddCategoryDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
