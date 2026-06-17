'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useCompanies } from '@/features/companies/hooks/useCompanies'
import { contactSchema, type ContactFormValues } from '../schemas/contact'

interface ContactFormProps {
  defaultValues?: Partial<ContactFormValues>
  onSubmit: (data: ContactFormValues) => Promise<void>
  submitLabel?: string
}

export function ContactForm({ defaultValues, onSubmit, submitLabel = 'Save' }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues,
  })

  const { data: companiesData } = useCompanies({ page_size: 100 })

  const handleSubmitWrapper = async (data: ContactFormValues) => {
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="first_name"
            {...register('first_name')}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          {errors.first_name && (
            <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="last_name" className="block text-sm font-medium">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="last_name"
            {...register('last_name')}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
          {errors.last_name && (
            <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          {...register('title')}
          placeholder="e.g. VP of Sales"
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
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
        <label htmlFor="company_id" className="block text-sm font-medium">
          Company
        </label>
        <select
          id="company_id"
          {...register('company_id', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">No company</option>
          {companiesData?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
