'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function CompanyFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

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
        placeholder="Search by name, website, phone…"
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => updateParam('q', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm w-72"
        aria-label="Search companies"
      />
      <input
        type="text"
        placeholder="Industry"
        defaultValue={searchParams.get('industry') ?? ''}
        onChange={(e) => updateParam('industry', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm w-40"
        aria-label="Filter by industry"
      />
    </div>
  )
}
