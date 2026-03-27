import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Fuel, Wrench } from 'lucide-react'
import { useVehiclesStore } from '@/stores/vehicles.store'

interface AddFabMenuProps {
  /** When provided, restricts vehicle links to this specific vehicle only (VehicleDetailPage use case). */
  vehicleId?: string
}

export function AddFabMenu({ vehicleId }: AddFabMenuProps) {
  const { t } = useTranslation()
  const { vehicles } = useVehiclesStore()
  const [open, setOpen] = useState(false)

  const activeVehicles = useMemo(
    () => vehicles.filter((v) => !v.archivedAt),
    [vehicles],
  )

  // When vehicleId is given (VehicleDetailPage), show only that vehicle.
  // Otherwise show all active vehicles (TransactionListPage behaviour).
  const vehiclesToShow = useMemo(() => {
    if (vehicleId) {
      const match = activeVehicles.find((v) => v.id === vehicleId)
      return match ? [match] : []
    }
    return activeVehicles
  }, [vehicleId, activeVehicles])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="fixed bottom-6 right-4 z-50 flex flex-col-reverse items-end gap-2">
        {open && (
          <>
            <Link
              to="/transactions/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 shadow-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <Plus size={16} className="text-indigo-500 shrink-0" />
              <span>{t('transactions.addTransaction')}</span>
            </Link>
            {vehiclesToShow.length === 1 ? (
              <>
                <Link
                  to={`/vehicles/${vehiclesToShow[0].id}/fuel/new`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 shadow-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <Fuel size={16} className="text-blue-500 shrink-0" />
                  <span>{t('vehicles.addFuelLog')}</span>
                </Link>
                <Link
                  to={`/vehicles/${vehiclesToShow[0].id}/service/new`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 shadow-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <Wrench size={16} className="text-orange-500 shrink-0" />
                  <span>{t('vehicles.addService')}</span>
                </Link>
              </>
            ) : vehiclesToShow.length > 1 ? (
              vehiclesToShow.map((v) => (
                <div key={v.id} className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white shadow">
                    {v.name}
                  </span>
                  <Link
                    to={`/vehicles/${v.id}/fuel/new`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 shadow-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
                  >
                    <Fuel size={16} className="text-blue-500 shrink-0" />
                    <span>{t('vehicles.addFuelLog')}</span>
                  </Link>
                  <Link
                    to={`/vehicles/${v.id}/service/new`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 shadow-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
                  >
                    <Wrench size={16} className="text-orange-500 shrink-0" />
                    <span>{t('vehicles.addService')}</span>
                  </Link>
                </div>
              ))
            ) : null}
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
          aria-label={open ? t('common.cancel') : t('common.add')}
        >
          <Plus size={26} className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </>
  )
}
