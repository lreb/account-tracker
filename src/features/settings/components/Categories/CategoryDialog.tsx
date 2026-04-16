import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'

import { categorySchema, type CategoryFormValues } from '../../schemas/category.schema'
import { useCategoriesStore } from '@/stores/categories.store'
import { ICON_MAP, CategoryIcon } from '@/lib/icon-map'
import type { Category, CategoryType } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type CategoryDialogProps = {
  open: boolean
  onClose: () => void
  editing?: Category
}

export default function CategoryDialog({
  open,
  onClose,
  editing,
}: CategoryDialogProps) {
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
  // not fire without `open` - leaving the form with whatever the user had typed.
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
        if (!v) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('categories.editCategory') : t('categories.newCategory')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="catName">{t('categories.categoryName')}</Label>
            <Input id="catName" placeholder={t('categories.namePlaceholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
          </div>

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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
            >
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
