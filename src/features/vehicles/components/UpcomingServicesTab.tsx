import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { AlertCircle, Clock, CheckCircle2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getServiceTypeLabel } from '@/lib/vehicles'
import type { UpcomingServiceItem } from './upcoming-services-tab.types'

interface UpcomingServicesTabProps {
  upcomingServices: UpcomingServiceItem[]
  vehicleId: string
}

const URGENCY_ORDER: Record<UpcomingServiceItem['urgency'], number> = {
  overdue: 0,
  soon: 1,
  upcoming: 2,
}

export default function UpcomingServicesTab({ upcomingServices, vehicleId }: UpcomingServicesTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Sort by urgency level, then by km proximity (ascending), then by due date (ascending).
  // Items closest to—or past—their service threshold surface first so the user immediately
  // sees what needs attention.
  const sorted = useMemo(() => {
    return [...upcomingServices].sort((a, b) => {
      const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
      if (urgencyDiff !== 0) return urgencyDiff

      // Within the same urgency band, sort by km proximity (most overdue / closest first)
      const aKm = a.kmRemaining ?? Infinity
      const bKm = b.kmRemaining ?? Infinity
      if (aKm !== bKm) return aKm - bKm

      // Tiebreak by due date (soonest first)
      const aDate = a.dueDate?.getTime() ?? Infinity
      const bDate = b.dueDate?.getTime() ?? Infinity
      return aDate - bDate
    })
  }, [upcomingServices])

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center mt-8">{t('vehicles.noUpcoming')}</p>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map(({ svc, urgency, kmRemaining, dueDate }) => {
        const bgClass =
          urgency === 'overdue' ? 'bg-red-50 border-red-200'
          : urgency === 'soon'  ? 'bg-amber-50 border-amber-200'
          : 'bg-emerald-50 border-emerald-200'
        const textClass =
          urgency === 'overdue' ? 'text-red-700'
          : urgency === 'soon'  ? 'text-amber-700'
          : 'text-emerald-700'
        const badgeBg =
          urgency === 'overdue' ? 'bg-red-100 text-red-700'
          : urgency === 'soon'  ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700'
        const UrgencyIcon =
          urgency === 'overdue' ? AlertCircle
          : urgency === 'soon'  ? Clock
          : CheckCircle2
        const urgencyLabel =
          urgency === 'overdue' ? t('vehicles.stats.overdue')
          : urgency === 'soon'  ? t('vehicles.stats.dueSoon')
          : t('vehicles.stats.upcomingLabel')

        return (
          <div key={svc.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${bgClass}`}>
            <UrgencyIcon size={14} className={`${textClass} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              {/* Service type + urgency badge */}
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-medium truncate ${textClass}`}>
                  {getServiceTypeLabel(svc.serviceType, t)}
                </p>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${badgeBg}`}>
                  {urgencyLabel}
                </span>
              </div>

              {/* Due criteria */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {svc.nextServiceKm != null && (
                  <p className={`text-xs ${textClass} opacity-80`}>
                    {t('vehicles.stats.dueAt', { km: svc.nextServiceKm.toLocaleString() })}
                    {kmRemaining !== null && (
                      <span className="ml-1 opacity-70">
                        {kmRemaining <= 0
                          ? `(${t('vehicles.stats.overdueByKm', { km: Math.abs(kmRemaining).toLocaleString() })})`
                          : `(${t('vehicles.stats.kmLeft', { km: kmRemaining.toLocaleString() })})`}
                      </span>
                    )}
                  </p>
                )}
                {dueDate && (
                  <p className={`text-xs ${textClass} opacity-80`}>
                    {t('vehicles.stats.dueOn', { date: format(dueDate, 'MMM d, yyyy') })}
                  </p>
                )}
              </div>

              {/* Last service notes */}
              {svc.notes && (
                <p className={`text-xs mt-0.5 ${textClass} opacity-60 truncate`}>{svc.notes}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-gray-700"
                  onClick={() => navigate(`/vehicles/${vehicleId}/service/${svc.id}`)}
                >
                  <Pencil size={13} />
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
