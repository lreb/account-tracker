import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'

import { useLabelsStore } from '@/stores/labels.store'
import type { Label } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ─── Preset colors ────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#14b8a6',
]

// ─── Zod schema ───────────────────────────────────────────────────────────────
const labelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(32),
  color: z.string().optional(),
})
type LabelFormValues = z.infer<typeof labelSchema>

// ─── Dialog ───────────────────────────────────────────────────────────────────
function LabelDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Label | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { add, update } = useLabelsStore()
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[5])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LabelFormValues>({
    resolver: zodResolver(labelSchema),
    defaultValues: { name: '', color: PRESET_COLORS[5] },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({ name: editing.name, color: editing.color ?? PRESET_COLORS[5] })
      setSelectedColor(editing.color ?? PRESET_COLORS[5])
    } else {
      reset({ name: '', color: PRESET_COLORS[5] })
      setSelectedColor(PRESET_COLORS[5])
    }
  }, [open, editing])

  const onSubmit = async (values: LabelFormValues) => {
    const payload: Label = {
      id: editing?.id ?? uuid(),
      name: values.name,
      color: selectedColor,
    }
    if (editing) {
      await update(payload)
    } else {
      await add(payload)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Label' : 'New Label'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1">
            <FormLabel htmlFor="lName">Name</FormLabel>
            <Input id="lName" placeholder="e.g. Business, Tax-deductible" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
          </div>

          <div className="space-y-2">
            <FormLabel>Color</FormLabel>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    selectedColor === color
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LabelsSettingsPage() {
  const { t } = useTranslation()
  const { labels, load, remove } = useLabelsStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Label | null>(null)

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (l: Label) => { setEditing(l); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('settings.labels')}</h1>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {labels.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <Tag size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">No labels yet.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Create your first label
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {labels.map((label) => (
            <li
              key={label.id}
              className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
            >
              <span
                className="h-4 w-4 rounded-full shrink-0"
                style={{ backgroundColor: label.color ?? '#6b7280' }}
              />
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border"
                style={{
                  backgroundColor: `${label.color ?? '#6b7280'}20`,
                  borderColor: `${label.color ?? '#6b7280'}60`,
                  color: label.color ?? '#6b7280',
                }}
              >
                {label.name}
              </span>
              <div className="flex gap-1 ml-auto shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(label)}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => remove(label.id)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LabelDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
    </div>
  )
}
