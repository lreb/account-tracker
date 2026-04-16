import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'
import { getTranslatedCategoryName } from '@/lib/categories'
import { ICON_MAP } from '@/lib/icon-map.constants'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Category } from '@/types'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  /** Pre-filtered list of categories to show */
  options: Category[]
  error?: string
}

export function CategorySelect({ value, onChange, options, error }: CategorySelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedCategory = options.find((c) => c.id === value)

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...options]
      .filter((c) => !q || getTranslatedCategoryName(c, t).toLowerCase().includes(q))
      .sort((a, b) =>
        getTranslatedCategoryName(a, t).localeCompare(getTranslatedCategoryName(b, t)),
      )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, search])

  function handleOpenChange(next: boolean) {
    if (next) setSearch('')
    setOpen(next)
  }

  function handleSelect(categoryId: string) {
    onChange(categoryId)
    setOpen(false)
  }

  function CategoryIcon({ iconName, className }: { iconName: string; className?: string }) {
    const Icon = ICON_MAP[iconName]
    return Icon ? <Icon className={className} /> : null
  }

  return (
    <div className="space-y-1">
      <Label>{t('settings.categories')}</Label>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-1 text-sm text-left transition-colors outline-none',
            'hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            error ? 'border-destructive ring-3 ring-destructive/20' : 'border-input',
          )}
          aria-invalid={!!error}
        >
          {selectedCategory ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <CategoryIcon iconName={selectedCategory.icon} className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{getTranslatedCategoryName(selectedCategory, t)}</span>
            </span>
          ) : (
            <span className="flex-1 text-muted-foreground">{t('transactions.selectCategory')}</span>
          )}
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DialogTrigger>

        <DialogContent
          showCloseButton={false}
          className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t('transactions.selectCategory')}</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="border-b px-4 py-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Category list */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {sorted.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t('common.noResults')}
              </p>
            ) : (
              sorted.map((cat) => {
                const isSelected = cat.id === value
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', isSelected ? 'bg-primary/20' : 'bg-muted')}>
                      <CategoryIcon iconName={cat.icon} className="size-4" />
                    </span>
                    <span className="font-medium">{getTranslatedCategoryName(cat, t)}</span>
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
