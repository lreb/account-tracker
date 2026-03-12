import { z } from 'zod'
import { vm } from '@/lib/validation-messages'

export const accountSchema = z.object({
  name: z.string().min(1, vm.nameRequired).max(50),
  type: z.enum(['asset', 'liability']),
  currency: z.string().min(3, vm.currencyRequired).max(3),
  openingBalance: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), vm.mustBeNumber)
    .default('0'),
})

export type AccountFormValues = z.infer<typeof accountSchema>
