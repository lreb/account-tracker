import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(30, 'Max 30 characters'),
  icon: z.string().min(1, 'Icon is required'),
})

export type CategoryFormValues = z.infer<typeof categorySchema>
