import { z } from 'zod'

export const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional().default(''),
  phone: z.string().optional().default(''),
  title: z.string().optional().default(''),
  company_id: z.number().nullable().optional(),
  owner_id: z.number().nullable().optional(),
})

export type ContactFormValues = z.infer<typeof contactSchema>
