'use client'

import { useSearchParams } from 'next/navigation'
import { CompanyFilters } from '@/features/companies/components/CompanyFilters'
import { CompanyTable } from '@/features/companies/components/CompanyTable'
import { useCompanies } from '@/features/companies/hooks/useCompanies'
import type { CompanyListParams } from '@/features/companies/types'

export function CompaniesView() {
  const searchParams = useSearchParams()

  const params: CompanyListParams = {
    q: searchParams.get('q') ?? undefined,
    industry: searchParams.get('industry') ?? undefined,
    owner: searchParams.get('owner') ? Number(searchParams.get('owner')) : undefined,
    ordering: searchParams.get('ordering') ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    page_size: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : 25,
  }

  const { data, isPending, isError } = useCompanies(params)

  return (
    <div className="space-y-4">
      <CompanyFilters />

      {isPending && <p className="text-muted-foreground">Loading companies…</p>}
      {isError && <p className="text-red-500">Failed to load companies. Please try again.</p>}
      {data && (
        <CompanyTable
          data={data.results}
          count={data.count}
          page={params.page ?? 1}
          pageSize={params.page_size ?? 25}
        />
      )}
    </div>
  )
}
