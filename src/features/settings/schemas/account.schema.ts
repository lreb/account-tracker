import { z } from 'zod'
import { vm } from '@/lib/validation-messages'

export const accountSchema = z.object({
  name: z.string().min(1, vm.nameRequired).max(50),
  type: z.enum(['asset', 'liability']),
  subtype: z.string().optional().default(''),
  currency: z.string().min(3, vm.currencyRequired).max(3),
  hidden: z.boolean().default(false),
  cancelled: z.boolean().default(false),
  openingBalance: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)), vm.mustBeNumber)
    .default('0'),
})

export type AccountFormValues = z.infer<typeof accountSchema>
