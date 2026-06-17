'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { useCompanies } from '@/features/companies/hooks/useCompanies'

export function ContactFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: companiesData } = useCompanies({ page_size: 100 })

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.replace(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="text"
        placeholder="Search by name, email, phone…"
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => updateParam('q', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm w-72"
        aria-label="Search contacts"
      />
      <select
        defaultValue={searchParams.get('company') ?? ''}
        onChange={(e) => updateParam('company', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm w-48"
        aria-label="Filter by company"
      >
        <option value="">All companies</option>
        {companiesData?.results.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
