import { z } from 'zod'
import { vm } from '@/lib/validation-messages'

export const recurringTransactionSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z
      .string()
      .min(1, vm.amountRequired)
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, vm.mustBePositive),
    categoryId: z.string().min(1, vm.categoryRequired),
    accountId: z.string().min(1, vm.accountRequired),
    toAccountId: z.string().optional(),
    description: z.string().min(1, vm.descriptionRequired).max(120),
    notes: z.string().max(500).optional(),
    status: z.enum(['pending', 'cleared', 'reconciled', 'cancelled']),
    currency: z.string().min(3, vm.currencyRequired),
    exchangeRate: z.string().optional(),
    // Schedule
    interval: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']),
    startDate: z.string().min(1, vm.dateRequired),
    time: z.string().min(1, 'validation.timeRequired'),
    totalOccurrences: z
      .string()
      .min(1, vm.amountRequired)
      .refine(
        (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 1,
        vm.mustBePositive,
      ),
  })
  .refine(
    (data) => {
      if (data.type === 'transfer') return Boolean(data.toAccountId)
      return true
    },
    { message: vm.toAccountRequired, path: ['toAccountId'] },
  )

export type RecurringTransactionFormValues = z.infer<typeof recurringTransactionSchema>
