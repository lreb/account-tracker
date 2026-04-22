import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag, AlertTriangle } from 'lucide-react'

import { useLabelsStore } from '@/stores/labels.store'
import { useTransactionsStore } from '@/stores/transactions.store'
import type { Label } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LabelFormValues>({
    resolver: zodResolver(labelSchema),
    defaultValues: { name: '', color: PRESET_COLORS[5] },
  })

  const selectedColor = watch('color') ?? PRESET_COLORS[5]

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({ name: editing.name, color: editing.color ?? PRESET_COLORS[5] })
    } else {
      reset({ name: '', color: PRESET_COLORS[5] })
    }
  }, [open, editing, reset])

  const onSubmit = async (values: LabelFormValues) => {
    const payload: Label = {
      id: editing?.id ?? uuid(),
      name: values.name,
      color: values.color ?? PRESET_COLORS[5],
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
                  onClick={() => setValue('color', color)}
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
  const transactions = useTransactionsStore((s) => s.transactions)
  const removeLabelFromTransactions = useTransactionsStore((s) => s.removeLabelFromTransactions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Label | null>(null)
  const [confirmOrphanId, setConfirmOrphanId] = useState<string | null>(null)

  useEffect(() => { load() }, [load])

  // Label IDs referenced in transactions but not present in the labels table
  const orphanLabels = useMemo<Label[]>(() => {
    const knownIds = new Set(labels.map((l) => l.id))
    const orphanIds = new Set<string>()
    for (const tx of transactions) {
      for (const id of tx.labels ?? []) {
        if (!knownIds.has(id)) orphanIds.add(id)
      }
    }
    return Array.from(orphanIds).map((id) => ({ id, name: id, color: '#6b7280' }))
  }, [transactions, labels])

  const orphanIds = useMemo(() => new Set(orphanLabels.map((l) => l.id)), [orphanLabels])

  const orphanTxCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tx of transactions) {
      for (const id of tx.labels ?? []) {
        if (orphanIds.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    return counts
  }, [transactions, orphanIds])

  const allLabels = useMemo(
    () => [...labels, ...orphanLabels].sort((a, b) => a.name.localeCompare(b.name)),
    [labels, orphanLabels],
  )

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (l: Label) => { setEditing(l); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  const handleDelete = async (id: string) => {
    await remove(id)
    await removeLabelFromTransactions(id)
  }

  const handleOrphanCleanup = async () => {
    if (!confirmOrphanId) return
    await removeLabelFromTransactions(confirmOrphanId)
    setConfirmOrphanId(null)
  }

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('settings.labels')}</h1>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {allLabels.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <Tag size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">No labels yet.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Create your first label
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {allLabels.map((label) => (
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
                {orphanIds.has(label.id)
                  ? <span className="italic max-w-[14ch] truncate inline-block">{label.name}</span>
                  : label.name}
              </span>
              {orphanIds.has(label.id) && (
                <span
                  title={t('settings.labelsOrphanHint')}
                  className="flex items-center gap-1 shrink-0 rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5"
                >
                  <AlertTriangle size={11} className="text-amber-500" />
                  <span className="text-[10px] font-medium text-amber-600">{t('settings.labelsOrphanBadge')}</span>
                </span>
              )}
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
                  onClick={() => orphanIds.has(label.id) ? setConfirmOrphanId(label.id) : handleDelete(label.id)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LabelDialog open={dialogOpen} editing={editing} onClose={closeDialog} />

      {/* ── Orphan cleanup confirmation ──────────────────────────────── */}
      <Dialog open={confirmOrphanId !== null} onOpenChange={(v) => { if (!v) setConfirmOrphanId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.labelsOrphanCleanupTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.labelsOrphanCleanupDesc', {
                count: orphanTxCounts.get(confirmOrphanId ?? '') ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOrphanId(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleOrphanCleanup}>
              {t('settings.labelsOrphanCleanupAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollToTopButton />
    </div>
  )
}
