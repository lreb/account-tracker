import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, SlidersHorizontal, X } from 'lucide-react'
import { format } from 'date-fns'
import { useTransactionsStore } from '@/stores/transactions.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useSettingsStore } from '@/stores/settings.store'
import { formatCurrency } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'

type TxType = 'income' | 'expense' | 'transfer'
type TxStatus = 'cleared' | 'pending' | 'reconciled' | 'cancelled'

interface Filters {
  search: string
  type: TxType | ''
  categoryId: string
  accountId: string
  status: TxStatus | ''
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  type: '',
  categoryId: '',
  accountId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense',  label: 'transactions.expense' },
  { value: 'income',   label: 'transactions.income' },
  { value: 'transfer', label: 'transactions.transfer' },
]

const STATUS_OPTIONS: { value: TxStatus; label: string }[] = [
  { value: 'cleared',    label: 'transactions.status.cleared' },
  { value: 'pending',    label: 'transactions.status.pending' },
  { value: 'reconciled', label: 'transactions.status.reconciled' },
  { value: 'cancelled',  label: 'transactions.status.cancelled' },
]

export default function TransactionListPage() {
  const { t } = useTranslation()
  const { transactions, load: loadTx } = useTransactionsStore()
  const { categories } = useCategoriesStore()
  const { accounts } = useAccountsStore()
  const { baseCurrency } = useSettingsStore()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  // draft = filters being edited inside the sheet; only committed on Apply
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)

  useEffect(() => { loadTx() }, [loadTx])

  const openSheet = () => { setDraft(filters); setSheetOpen(true) }
  const applyFilters = () => { setFilters(draft); setSheetOpen(false) }
  const resetFilters = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setSheetOpen(false) }
  const removeChip = (key: keyof Filters) =>
    setFilters((prev) => ({ ...prev, [key]: '' }))

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return transactions.filter((tx) => {
      if (q && !tx.description.toLowerCase().includes(q) && !(tx.notes ?? '').toLowerCase().includes(q)) return false
      if (filters.type && tx.type !== filters.type) return false
      if (filters.categoryId && tx.categoryId !== filters.categoryId) return false
      if (filters.accountId && tx.accountId !== filters.accountId) return false
      if (filters.status && tx.status !== filters.status) return false
      if (filters.dateFrom && tx.date < new Date(filters.dateFrom).toISOString()) return false
      if (filters.dateTo) {
        const end = new Date(filters.dateTo)
        end.setHours(23, 59, 59, 999)
        if (tx.date > end.toISOString()) return false
      }
      return true
    })
  }, [transactions, filters])

  const activeCount = Object.values(filters).filter(Boolean).length

  const chips: { key: keyof Filters; label: string }[] = [
    filters.search    ? { key: 'search',     label: `"${filters.search}"` }                                              : null,
    filters.type      ? { key: 'type',        label: t(`transactions.${filters.type}`) }                                 : null,
    filters.categoryId? { key: 'categoryId',  label: categories.find((c) => c.id === filters.categoryId)?.name ?? '' }   : null,
    filters.accountId ? { key: 'accountId',   label: accounts.find((a) => a.id === filters.accountId)?.name ?? '' }      : null,
    filters.status    ? { key: 'status',      label: t(`transactions.status.${filters.status}`) }                        : null,
    filters.dateFrom  ? { key: 'dateFrom',    label: `From ${filters.dateFrom}` }                                        : null,
    filters.dateTo    ? { key: 'dateTo',      label: `To ${filters.dateTo}` }                                            : null,
  ].filter(Boolean) as { key: keyof Filters; label: string }[]

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">{t('transactions.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSheet}
            className="relative flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm"
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
          <Link
            to="/transactions/new"
            className="flex items-center gap-1 rounded-full bg-indigo-600 text-white px-4 py-1.5 text-sm font-medium"
          >
            <Plus size={16} />
            {t('common.add')}
          </Link>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => removeChip(key)}
              className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs text-indigo-700"
            >
              {label} <X size={10} />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* List */}
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center mt-12">
          No transactions yet. Tap + to add one.
        </p>
      ) : filtered.length === 0 ? (
        <div className="text-center mt-12 space-y-2">
          <p className="text-sm text-gray-400">No transactions match your filters.</p>
          <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId)
            const acc = accounts.find((a) => a.id === tx.accountId)
            return (
              <li key={tx.id}>
                <Link
                  to={`/transactions/${tx.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {cat?.name ?? '—'} · {acc?.name ?? '—'} · {format(new Date(tx.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${
                      tx.type === 'income' ? 'text-green-600' :
                      tx.type === 'expense' ? 'text-red-500' : 'text-gray-700'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                      {formatCurrency(tx.amount, tx.currency ?? baseCurrency)}
                    </p>
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {t(`transactions.status.${tx.status}`)}
                    </Badge>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Filter sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Filter Transactions</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="space-y-1">
              <Label>Keyword</Label>
              <Input
                placeholder="Search description or notes…"
                value={draft.search}
                onChange={(e) => setDraft((p) => ({ ...p, search: e.target.value }))}
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From</Label>
                <Input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft((p) => ({ ...p, dateFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) => setDraft((p) => ({ ...p, dateTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label>Type</Label>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
                {[{ value: '' as const, label: 'All' }, ...TYPE_OPTIONS].map(({ value, label }) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, type: value as Filters['type'] }))}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      draft.type === value ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {value ? t(label) : label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={draft.categoryId || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, categoryId: v === '__all__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account */}
            <div className="space-y-1">
              <Label>Account</Label>
              <Select
                value={draft.accountId || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, accountId: v === '__all__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All accounts</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={draft.status || '__all__'}
                onValueChange={(v) => setDraft((p) => ({ ...p, status: v === '__all__' ? '' : v as TxStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All statuses</SelectItem>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{t(label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={resetFilters}>Reset</Button>
            <Button className="flex-1" onClick={applyFilters}>Apply</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
