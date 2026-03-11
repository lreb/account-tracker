import { z } from 'zod'

export const vehicleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  make: z.string().max(30).optional(),
  model: z.string().max(30).optional(),
  year: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().min(1900).max(2100).optional()),
})

export type VehicleFormValues = z.input<typeof vehicleSchema>

// ─── Fuel log ────────────────────────────────────────────────────────────────

export const fuelLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  liters: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/, 'Invalid liters')
    .refine((v) => parseFloat(v) > 0, 'Must be > 0'),
  totalCost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) > 0, 'Must be > 0'),
  odometer: z
    .string()
    .regex(/^\d+$/, 'Integer km only')
    .refine((v) => parseInt(v, 10) >= 0, 'Must be ≥ 0'),
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
})

export type FuelLogFormValues = z.infer<typeof fuelLogSchema>

// ─── Vehicle service ─────────────────────────────────────────────────────────

export const vehicleServiceSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  serviceType: z.string().min(1, 'Service type is required').max(60),
  cost: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) >= 0, 'Must be ≥ 0'),
  odometer: z
    .string()
    .regex(/^\d+$/, 'Integer km only')
    .refine((v) => parseInt(v, 10) >= 0, 'Must be ≥ 0'),
  notes: z.string().max(200).optional(),
  nextServiceKm: z.string().optional(),
  nextServiceDate: z.string().optional(),
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
})

export type VehicleServiceFormValues = z.infer<typeof vehicleServiceSchema>
