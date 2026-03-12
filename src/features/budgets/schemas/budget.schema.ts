import { z } from 'zod'
import { vm } from '@/lib/validation-messages'

export const budgetSchema = z.object({
  categoryId: z.string().min(1, vm.categoryRequired),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, vm.invalidAmount)
    .refine((v) => parseFloat(v) > 0, vm.amountPositive),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  rollover: z.boolean().default(false),
  startDate: z.string().min(1, vm.startDateRequired),
  endDate: z.string().optional(),
})

export type BudgetFormValues = z.infer<typeof budgetSchema>
