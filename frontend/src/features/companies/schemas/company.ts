import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  industry: z.string().optional().default(''),
  website: z.string().url('Enter a valid URL').or(z.literal('')).optional().default(''),
  phone: z.string().optional().default(''),
  billing_address: z.string().optional().default(''),
  shipping_address: z.string().optional().default(''),
  annual_revenue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative number')
    .optional()
    .or(z.literal(''))
    .nullable(),
  employee_count: z
    .number({ invalid_type_error: 'Must be a whole number' })
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  owner: z.number().nullable().optional(),
})

export type CompanyFormValues = z.infer<typeof companySchema>
