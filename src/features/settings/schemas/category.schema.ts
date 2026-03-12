import { z } from 'zod'
import { vm } from '@/lib/validation-messages'

export const categorySchema = z.object({
  name: z.string().min(1, vm.nameRequired).max(30, vm.max30chars),
  icon: z.string().min(1, vm.iconRequired),
  type: z.enum(['income', 'expense', 'any']),
})

export type CategoryFormValues = z.infer<typeof categorySchema>
