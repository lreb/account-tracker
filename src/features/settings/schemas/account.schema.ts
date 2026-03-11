import { z } from 'zod'

export const accountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['cash', 'bank', 'card', 'savings', 'investment', 'other']),
  currency: z.string().min(3, 'Currency is required').max(3),
  openingBalance: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), 'Must be a valid number')
    .default('0'),
})

export type AccountFormValues = z.infer<typeof accountSchema>
