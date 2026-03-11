import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { Plus, Car, ChevronRight, Pencil, Trash2 } from 'lucide-react'

import { vehicleSchema, type VehicleFormValues } from '../schemas/vehicle.schema'
import { useVehiclesStore } from '@/stores/vehicles.store'
import type { Vehicle } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const { addVehicle, updateVehicle } = useVehiclesStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          make: editing.make ?? '',
          model: editing.model ?? '',
          year: editing.year?.toString() ?? '',
        }
      : { name: '', make: '', model: '', year: '' },
  })

  const onSubmit = async (values: VehicleFormValues) => {
    const payload: Vehicle = {
      id: editing?.id ?? uuid(),
      name: values.name,
      make: values.make || undefined,
      model: values.model || undefined,
      year: values.year,
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
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
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
            {errors.year && <p className="text-xs text-red-500">{errors.year.message}</p>}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { vehicles, removeVehicle } = useVehiclesStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (v: Vehicle) => { setEditing(v); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditing(null) }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('vehicles.title')}</h1>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus size={16} />
          Add
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center mt-16 space-y-2">
          <Car size={40} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">No vehicles yet.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            Add your first vehicle
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {vehicles.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 shrink-0">
                <Car size={20} className="text-gray-500" />
              </span>

              <button
                className="flex-1 min-w-0 text-left"
                onClick={() => navigate(`/vehicles/${v.id}`)}
              >
                <p className="text-sm font-semibold">{v.name}</p>
                <p className="text-xs text-gray-400">
                  {[v.make, v.model, v.year].filter(Boolean).join(' · ') || 'No details'}
                </p>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(v)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => removeVehicle(v.id)}
                >
                  <Trash2 size={14} />
                </Button>
                <ChevronRight
                  size={16}
                  className="text-gray-300 cursor-pointer"
                  onClick={() => navigate(`/vehicles/${v.id}`)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <VehicleDialog open={dialogOpen} editing={editing} onClose={closeDialog} />
    </div>
  )
}
