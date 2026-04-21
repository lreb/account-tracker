import type { VehicleService } from '@/types'

export interface UpcomingServiceItem {
  svc: VehicleService
  urgency: 'overdue' | 'soon' | 'upcoming'
  kmRemaining: number | null
  dueDate: Date | null
}
