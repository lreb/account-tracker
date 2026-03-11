import { z } from 'zod'

export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  rollover: z.boolean().default(false),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
})

export type BudgetFormValues = z.infer<typeof budgetSchema>
