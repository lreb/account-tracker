import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Vehicle, FuelLog, VehicleService } from '@/types'

interface VehiclesState {
  vehicles: Vehicle[]
  fuelLogs: FuelLog[]
  vehicleServices: VehicleService[]
  load: () => Promise<void>
  addVehicle: (v: Vehicle) => Promise<void>
  updateVehicle: (v: Vehicle) => Promise<void>
  removeVehicle: (id: string) => Promise<void>
  addFuelLog: (f: FuelLog) => Promise<void>
  removeFuelLog: (id: string) => Promise<void>
  addService: (s: VehicleService) => Promise<void>
  removeService: (id: string) => Promise<void>
}

export const useVehiclesStore = create<VehiclesState>((set) => ({
  vehicles: [],
  fuelLogs: [],
  vehicleServices: [],

  load: async () => {
    try {
      const [vehicles, fuelLogs, vehicleServices] = await Promise.all([
        db.vehicles.toArray(),
        db.fuelLogs.orderBy('date').reverse().toArray(),
        db.vehicleServices.orderBy('date').reverse().toArray(),
      ])
      set({ vehicles, fuelLogs, vehicleServices })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load vehicle data')
    }
  },

  addVehicle: async (vehicle) => {
    try {
      await db.vehicles.add(vehicle)
      set((s) => ({ vehicles: [...s.vehicles, vehicle] }))
      toast.success('Vehicle added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add vehicle')
    }
  },

  updateVehicle: async (vehicle) => {
    try {
      await db.vehicles.put(vehicle)
      set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)) }))
      toast.success('Vehicle updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update vehicle')
    }
  },

  removeVehicle: async (id) => {
    try {
      await db.vehicles.delete(id)
      set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) }))
      toast.success('Vehicle deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete vehicle')
    }
  },

  addFuelLog: async (fuelLog) => {
    try {
      await db.fuelLogs.add(fuelLog)
      set((s) => ({ fuelLogs: [fuelLog, ...s.fuelLogs] }))
      toast.success('Fuel log added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add fuel log')
    }
  },

  removeFuelLog: async (id) => {
    try {
      await db.fuelLogs.delete(id)
      set((s) => ({ fuelLogs: s.fuelLogs.filter((f) => f.id !== id) }))
      toast.success('Fuel log deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete fuel log')
    }
  },

  addService: async (service) => {
    try {
      await db.vehicleServices.add(service)
      set((s) => ({ vehicleServices: [service, ...s.vehicleServices] }))
      toast.success('Service record added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add service record')
    }
  },

  removeService: async (id) => {
    try {
      await db.vehicleServices.delete(id)
      set((s) => ({ vehicleServices: s.vehicleServices.filter((s) => s.id !== id) }))
      toast.success('Service record deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete service record')
    }
  },
}))
