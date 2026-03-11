import { z } from 'zod'

export const transactionSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
    date: z.string().min(1, 'Date is required'),
    categoryId: z.string().min(1, 'Category is required'),
    accountId: z.string().min(1, 'Account is required'),
    toAccountId: z.string().optional(),
    description: z.string().min(1, 'Description is required').max(120),
    notes: z.string().max(500).optional(),
    status: z.enum(['pending', 'cleared', 'reconciled', 'cancelled']),
    currency: z.string().min(3, 'Currency is required'),
    exchangeRate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'transfer') return Boolean(data.toAccountId)
      return true
    },
    { message: 'Destination account is required for transfers', path: ['toAccountId'] },
  )

export type TransactionFormValues = z.infer<typeof transactionSchema>
