'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { companySchema, type CompanyFormValues } from '../schemas/company'

interface CompanyFormProps {
  defaultValues?: Partial<CompanyFormValues>
  onSubmit: (data: CompanyFormValues) => Promise<void>
  submitLabel?: string
}

export function CompanyForm({ defaultValues, onSubmit, submitLabel = 'Save' }: CompanyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues,
  })

  const handleSubmitWrapper = async (data: CompanyFormValues) => {
    try {
      await onSubmit(data)
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'An error occurred',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitWrapper)} className="space-y-4 max-w-2xl">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="industry" className="block text-sm font-medium">
          Industry
        </label>
        <input
          id="industry"
          {...register('industry')}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="website" className="block text-sm font-medium">
          Website
        </label>
        <input
          id="website"
          type="url"
          {...register('website')}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website.message}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone
        </label>
        <input
          id="phone"
          {...register('phone')}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="billing_address" className="block text-sm font-medium">
          Billing Address
        </label>
        <textarea
          id="billing_address"
          {...register('billing_address')}
          rows={2}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="shipping_address" className="block text-sm font-medium">
          Shipping Address
        </label>
        <textarea
          id="shipping_address"
          {...register('shipping_address')}
          rows={2}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="annual_revenue" className="block text-sm font-medium">
          Annual Revenue
        </label>
        <input
          id="annual_revenue"
          {...register('annual_revenue')}
          placeholder="e.g. 1000000.00"
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.annual_revenue && (
          <p className="mt-1 text-xs text-red-500">{errors.annual_revenue.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="employee_count" className="block text-sm font-medium">
          Employee Count
        </label>
        <input
          id="employee_count"
          type="number"
          min={0}
          {...register('employee_count', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.employee_count && (
          <p className="mt-1 text-xs text-red-500">{errors.employee_count.message}</p>
        )}
      </div>

      {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
