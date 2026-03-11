import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { format } from 'date-fns'
import { Plus, Car, ChevronRight, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react'

import { vehicleSchema, type VehicleFormValues } from '../schemas/vehicle.schema'
import { useVehiclesStore } from '@/stores/vehicles.store'
import type { Vehicle } from '@/types'

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

// ─── Add / Edit dialog ────────────────────────────────────────────────────────

function VehicleDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Vehicle | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { addVehicle, updateVehicle } = useVehiclesStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { name: '', make: '', model: '', year: '' },
  })

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        name: editing.name,
        make: editing.make ?? '',
        model: editing.model ?? '',
        year: editing.year?.toString() ?? '',
      })
    } else {
      reset({ name: '', make: '', model: '', year: '' })
    }
  }, [open, editing, reset])

  const onSubmit = async (values: VehicleFormValues) => {
    const payload: Vehicle = {
      id: editing?.id ?? uuid(),
      name: values.name,
      make: values.make || undefined,
      model: values.model || undefined,
      year: values.year,
      archivedAt: editing?.archivedAt,
    }
    if (editing) {
      await updateVehicle(payload)
    } else {
      await addVehicle(payload)
    }
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="vName">Display Name *</Label>
            <Input id="vName" placeholder="e.g. My Car, Work Truck" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message!)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vMake">Make</Label>
              <Input id="vMake" placeholder="Toyota" {...register('make')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vModel">Model</Label>
              <Input id="vModel" placeholder="Corolla" {...register('model')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="vYear">Year</Label>
            <Input id="vYear" type="number" placeholder="2020" {...register('year')} />
            {errors.year && <p className="text-xs text-red-500">{t(errors.year.message!)}</p>}
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

// ─── Vehicle row ──────────────────────────────────────────────────────────────

function VehicleRow({
  vehicle,
  onEdit,
}: {
  vehicle: Vehicle
  onEdit: (v: Vehicle) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { archiveVehicle, unarchiveVehicle } = useVehiclesStore()
  const isArchived = Boolean(vehicle.archivedAt)

  return (
    <li className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
      isArchived ? 'bg-gray-50 border-dashed opacity-70' : 'bg-white'
    }`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
        isArchived ? 'bg-gray-100' : 'bg-indigo-50'
      }`}>
        <Car size={20} className={isArchived ? 'text-gray-400' : 'text-indigo-500'} />
      </span>

      <button
        className="flex-1 min-w-0 text-left"
        onClick={() => !isArchived && navigate(`/vehicles/${vehicle.id}`)}
        disabled={isArchived}
      >
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${isArchived ? 'text-gray-500' : ''}`}>
            {vehicle.name}
          </p>
          {isArchived && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 bg-amber-50">
              {t('vehicles.archived')}
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'No details'}
        </p>
        {isArchived && vehicle.archivedAt && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {t('vehicles.archivedSince', { date: format(new Date(vehicle.archivedAt), 'MMM d, yyyy') })}
          </p>
        )}
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {!isArchived && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(vehicle)}
            title="Edit"
          >
            <Pencil size={14} />
          </Button>
        )}
        {isArchived ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => unarchiveVehicle(vehicle.id)}
            title={t('vehicles.unarchive')}
          >
            <ArchiveRestore size={14} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
            onClick={() => archiveVehicle(vehicle.id)}
            title={t('vehicles.archive')}
          >
            <Archive size={14} />
          </Button>
        )}
        {!isArchived && (
          <ChevronRight
            size={16}
            className="text-gray-300 cursor-pointer"
            onClick={() => navigate(`/vehicles/${vehicle.id}`)}
          />
        )}
      </div>
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleListPage() {
  const { t } = useTranslation()
  const { vehicles, load } = useVehiclesStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => { load() }, [load])

  const active   = vehicles.filter((v) => !v.archivedAt)
  const archived = vehicles.filter((v) => Boolean(v.archivedAt))

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (v: Vehicle) => { setEditing(v); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('vehicles.title')}</h1>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {/* Active vehicles */}
      {active.length === 0 ? (
        <div className="text-center mt-12 space-y-2">
          <Car size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">{t('vehicles.noActive')}</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Add your first vehicle
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {active.map((v) => (
            <VehicleRow key={v.id} vehicle={v} onEdit={openEdit} />
          ))}
        </ul>
      )}

      {/* Archived section — collapsible, only shown when there are archived vehicles */}
      {archived.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2 w-full"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {t('vehicles.archived')}
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {archived.length}
            </span>
          </button>

          {showArchived && (
            <ul className="space-y-2">
              {archived.map((v) => (
                <VehicleRow key={v.id} vehicle={v} onEdit={openEdit} />
              ))}
            </ul>
          )}
        </div>
      )}

      <VehicleDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
    </div>
  )
}
