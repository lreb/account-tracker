import { z } from 'zod'
import { vm } from '@/lib/validation-messages'

export const vehicleSchema = z.object({
  name: z.string().min(1, vm.nameRequired).max(50),
  make: z.string().max(30).optional(),
  model: z.string().max(30).optional(),
  year: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().min(1900).max(2100).optional()),
  initialOdometer: z.string().optional(),
})

export type VehicleFormValues = z.input<typeof vehicleSchema>

// ─── Predefined service types ────────────────────────────────────────────────

export const SERVICE_TYPES = [
  'Oil change',
  'Tire rotation',
  'Tire replacement',
  'Brake pads',
  'Brake discs',
  'Battery replacement',
  'Timing belt',
  'Spark plugs',
  'Air filter',
  'Cabin filter',
  'Fuel filter',
  'Transmission fluid',
  'Coolant flush',
  'Alignment',
  'Suspension',
  'AC service',
  'General inspection',
  'Other',
] as const

// ─── Fuel log ────────────────────────────────────────────────────────────────

export const fuelLogSchema = z.object({
  date: z.string().min(1, vm.dateRequired),
  time: z.string().min(1, 'validation.timeRequired'),
  description: z.string().max(100).optional(),
  liters: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/, vm.invalidLiters)
    .refine((v) => parseFloat(v) > 0, vm.mustBePositive),
  costPerLiter: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, vm.invalidAmount)
    .refine((v) => parseFloat(v) > 0, vm.mustBePositive),
  totalCost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, vm.invalidAmount)
    .refine((v) => parseFloat(v) > 0, vm.mustBePositive),
  odometer: z
    .string()
    .regex(/^\d+$/, vm.integerKmOnly)
    .refine((v) => parseInt(v, 10) >= 0, vm.mustBeNonNegative),
  accountId: z.string().min(1, vm.accountRequired),
  categoryId: z.string().min(1, vm.categoryRequired),
  status: z.enum(['pending', 'cleared', 'reconciled', 'cancelled']).default('cleared'),
  notes: z.string().max(200).optional(),
  labels: z.array(z.string()).optional(),
})

export type FuelLogFormValues = z.infer<typeof fuelLogSchema>

// ─── Vehicle service ─────────────────────────────────────────────────────────

export const vehicleServiceSchema = z.object({
  date: z.string().min(1, vm.dateRequired),
  time: z.string().min(1, 'validation.timeRequired'),
  description: z.string().max(100).optional(),
  serviceType: z.string().min(1, vm.serviceTypeRequired).max(60),
  cost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, vm.invalidAmount)
    .refine((v) => parseFloat(v) >= 0, vm.mustBeNonNegative),
  odometer: z
    .string()
    .regex(/^\d+$/, vm.integerKmOnly)
    .refine((v) => parseInt(v, 10) >= 0, vm.mustBeNonNegative),
  notes: z.string().max(200).optional(),
  nextServiceKm: z.string().optional(),
  nextServiceDate: z.string().optional(),
  accountId: z.string().min(1, vm.accountRequired),
  categoryId: z.string().min(1, vm.categoryRequired),
  status: z.enum(['pending', 'cleared', 'reconciled', 'cancelled']).default('cleared'),
  labels: z.array(z.string()).optional(),
})

export type VehicleServiceFormValues = z.infer<typeof vehicleServiceSchema>
