import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, Search } from 'lucide-react'

import type { Label } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface LabelPickerButtonProps {
  labels: Label[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function LabelPickerButton({ labels, selectedIds, onChange }: LabelPickerButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [search, setSearch] = useState('')

  if (labels.length === 0) return null

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(selectedIds)
      setSearch('')
    }
    setOpen(nextOpen)
  }

  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    )
  }

  const handleSave = () => {
    onChange(draft)
    setOpen(false)
  }

  const handleCancel = () => {
    setOpen(false)
  }

  const filtered = search.trim()
    ? labels.filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase()))
    : labels

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id))

  return (
    <div className="space-y-1.5">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Tag size={13} />
          {t('transactions.labels')}
          {selectedIds.length > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-px text-[10px] font-semibold leading-none">
              {selectedIds.length}
            </span>
          )}
        </DialogTrigger>

        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('transactions.labels')}</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Scrollable label list */}
          <div className="flex flex-wrap gap-2 py-1 max-h-52 overflow-y-auto pr-0.5">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground w-full text-center py-6">
                {t('common.noResults')}
              </p>
            ) : (
              filtered.map((lbl) => {
                const active = draft.includes(lbl.id)
                return (
                  <button
                    key={lbl.id}
                    type="button"
                    onClick={() => toggle(lbl.id)}
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium border-2 transition-all"
                    style={{
                      backgroundColor: active ? `${lbl.color ?? '#6b7280'}22` : 'transparent',
                      borderColor: lbl.color ?? '#6b7280',
                      color: lbl.color ?? '#6b7280',
                      opacity: active ? 1 : 0.45,
                    }}
                  >
                    {lbl.name}
                  </button>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft([])}
              disabled={draft.length === 0}
            >
              {t('transactions.clearAll')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((lbl) => (
            <span
              key={lbl.id}
              className="inline-flex items-center rounded-full px-2 py-px text-xs font-medium"
              style={{
                backgroundColor: `${lbl.color ?? '#6b7280'}18`,
                color: lbl.color ?? '#6b7280',
              }}
            >
              {lbl.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
