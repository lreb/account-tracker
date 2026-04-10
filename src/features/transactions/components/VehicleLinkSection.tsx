import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Car, Fuel, Wrench } from 'lucide-react'

import { useVehiclesStore } from '@/stores/vehicles.store'
import { SERVICE_TYPES } from '@/features/vehicles/schemas/vehicle.schema'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VehicleLinkState } from './vehicle-link-section.types'

interface Props {
  vehicleLink: VehicleLinkState
  onChange: Dispatch<SetStateAction<VehicleLinkState>>
}

export default function VehicleLinkSection({ vehicleLink, onChange }: Props) {
  const { t } = useTranslation()
  const { vehicles } = useVehiclesStore()

  const activeVehicles = vehicles.filter((v) => !v.archivedAt)

  return (
    <div className="rounded-2xl border bg-gray-50 p-4 space-y-4">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Car size={15} />
          {t('vehicles.linkToVehicle')}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={vehicleLink.enabled}
          onClick={() => onChange((p) => ({ ...p, enabled: !p.enabled }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            vehicleLink.enabled ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              vehicleLink.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {vehicleLink.enabled && (
        <>
          {/* Vehicle select — shows name, stores id as value */}
          <div className="space-y-1">
            <Label>{t('vehicles.vehicle')}</Label>
            <Select
              value={vehicleLink.vehicleId}
              onValueChange={(v) => onChange((p) => ({ ...p, vehicleId: v ?? '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('vehicles.selectVehicle')}>
                  {activeVehicles.find((v) => v.id === vehicleLink.vehicleId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fuel / Service tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            {(['fuel', 'service'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange((p) => ({ ...p, linkType: type }))}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                  vehicleLink.linkType === type
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {type === 'fuel' ? <Fuel size={13} /> : <Wrench size={13} />}
                {t(type === 'fuel' ? 'vehicles.tabFuel' : 'vehicles.tabService')}
              </button>
            ))}
          </div>

          {/* Fuel fields */}
          {vehicleLink.linkType === 'fuel' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('vehicles.odometer')}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={vehicleLink.odometer}
                  onChange={(e) => onChange((p) => ({ ...p, odometer: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('vehicles.liters')}</Label>
                <Input
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  placeholder="0.000"
                  value={vehicleLink.liters}
                  onChange={(e) => onChange((p) => ({ ...p, liters: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Service fields */}
          {vehicleLink.linkType === 'service' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t('vehicles.serviceType')}</Label>
                <Select
                  value={vehicleLink.serviceType}
                  onValueChange={(v) => onChange((p) => ({ ...p, serviceType: v ?? '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('vehicles.selectServiceType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('vehicles.odometer')}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={vehicleLink.odometer}
                  onChange={(e) => onChange((p) => ({ ...p, odometer: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('vehicles.nextServiceKm')}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('common.optional')}
                    value={vehicleLink.nextServiceKm}
                    onChange={(e) => onChange((p) => ({ ...p, nextServiceKm: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('vehicles.nextServiceDate')}</Label>
                  <Input
                    type="date"
                    value={vehicleLink.nextServiceDate}
                    onChange={(e) => onChange((p) => ({ ...p, nextServiceDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
