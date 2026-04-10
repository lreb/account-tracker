export type VehicleLinkState = {
  enabled: boolean
  vehicleId: string
  linkType: 'fuel' | 'service'
  odometer: string
  liters: string
  serviceType: string
  nextServiceKm: string
  nextServiceDate: string
}

export const VEHICLE_LINK_INITIAL_STATE: VehicleLinkState = {
  enabled: false,
  vehicleId: '',
  linkType: 'fuel',
  odometer: '',
  liters: '',
  serviceType: '',
  nextServiceKm: '',
  nextServiceDate: '',
}
