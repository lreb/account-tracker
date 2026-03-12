import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import { useTransactionsStore } from './transactions.store'
import type { Vehicle, FuelLog, VehicleService, Transaction } from '@/types'

interface VehiclesState {
  vehicles: Vehicle[]
  fuelLogs: FuelLog[]
  vehicleServices: VehicleService[]
  load: () => Promise<void>
  addVehicle: (v: Vehicle) => Promise<void>
  updateVehicle: (v: Vehicle) => Promise<void>
  archiveVehicle: (id: string) => Promise<void>
  unarchiveVehicle: (id: string) => Promise<void>
  removeVehicle: (id: string) => Promise<void>
  addFuelLog: (f: FuelLog) => Promise<void>
  updateFuelLog: (log: FuelLog, linkedTx?: Transaction) => Promise<void>
  removeFuelLog: (id: string) => Promise<void>
  addService: (s: VehicleService) => Promise<void>
  updateService: (svc: VehicleService, linkedTx?: Transaction) => Promise<void>
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

  archiveVehicle: async (id) => {
    try {
      const archivedAt = new Date().toISOString()
      await db.vehicles.update(id, { archivedAt })
      set((s) => ({
        vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, archivedAt } : v)),
      }))
      toast.success('Vehicle archived')
    } catch (err) {
      console.error(err)
      toast.error('Failed to archive vehicle')
    }
  },

  unarchiveVehicle: async (id) => {
    try {
      await db.vehicles.update(id, { archivedAt: undefined })
      set((s) => ({
        vehicles: s.vehicles.map((v) => {
          if (v.id !== id) return v
          const { archivedAt: _, ...rest } = v
          return rest
        }),
      }))
      toast.success('Vehicle restored')
    } catch (err) {
      console.error(err)
      toast.error('Failed to restore vehicle')
    }
  },

  removeVehicle: async (id) => {
    try {
      // Cascade: delete all fuel logs + services + their linked transactions
      const logs = await db.fuelLogs.where('vehicleId').equals(id).toArray()
      const svcs = await db.vehicleServices.where('vehicleId').equals(id).toArray()
      const txIds = [
        ...logs.map((l) => l.transactionId),
        ...svcs.map((s) => s.transactionId),
      ].filter((txId): txId is string => Boolean(txId))
      if (txIds.length > 0) {
        await db.transactions.bulkDelete(txIds)
        useTransactionsStore.getState().removeMany(txIds)
      }
      await db.fuelLogs.where('vehicleId').equals(id).delete()
      await db.vehicleServices.where('vehicleId').equals(id).delete()
      await db.vehicles.delete(id)
      set((s) => ({
        vehicles: s.vehicles.filter((v) => v.id !== id),
        fuelLogs: s.fuelLogs.filter((f) => f.vehicleId !== id),
        vehicleServices: s.vehicleServices.filter((sv) => sv.vehicleId !== id),
      }))
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

  updateFuelLog: async (log, linkedTx) => {
    try {
      if (linkedTx) {
        await db.transactions.put(linkedTx)
        useTransactionsStore.setState((s) => ({
          transactions: s.transactions.map((t) => (t.id === linkedTx.id ? linkedTx : t)),
        }))
      }
      await db.fuelLogs.put(log)
      set((s) => ({ fuelLogs: s.fuelLogs.map((f) => (f.id === log.id ? log : f)) }))
      toast.success('Fuel log updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update fuel log')
    }
  },

  removeFuelLog: async (id) => {
    try {
      const log = await db.fuelLogs.get(id)
      if (log?.transactionId) {
        await db.transactions.delete(log.transactionId)
        useTransactionsStore.getState().removeMany([log.transactionId])
      }
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

  updateService: async (svc, linkedTx) => {
    try {
      if (linkedTx) {
        await db.transactions.put(linkedTx)
        useTransactionsStore.setState((s) => ({
          transactions: s.transactions.map((t) => (t.id === linkedTx.id ? linkedTx : t)),
        }))
      }
      await db.vehicleServices.put(svc)
      set((s) => ({ vehicleServices: s.vehicleServices.map((sv) => (sv.id === svc.id ? svc : sv)) }))
      toast.success('Service record updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update service record')
    }
  },

  removeService: async (id) => {
    try {
      const svc = await db.vehicleServices.get(id)
      if (svc?.transactionId) {
        await db.transactions.delete(svc.transactionId)
        useTransactionsStore.getState().removeMany([svc.transactionId])
      }
      await db.vehicleServices.delete(id)
      set((s) => ({ vehicleServices: s.vehicleServices.filter((sv) => sv.id !== id) }))
      toast.success('Service record deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete service record')
    }
  },
}))
