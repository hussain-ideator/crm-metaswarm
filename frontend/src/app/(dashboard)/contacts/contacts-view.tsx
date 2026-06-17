'use client'

import { useSearchParams } from 'next/navigation'
import { ContactFilters } from '@/features/contacts/components/ContactFilters'
import { ContactTable } from '@/features/contacts/components/ContactTable'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import type { ContactListParams } from '@/features/contacts/types'

export function ContactsView() {
  const searchParams = useSearchParams()

  const params: ContactListParams = {
    q: searchParams.get('q') ?? undefined,
    company: searchParams.get('company') ? Number(searchParams.get('company')) : undefined,
    owner: searchParams.get('owner') ? Number(searchParams.get('owner')) : undefined,
    ordering: searchParams.get('ordering') ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    page_size: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : 25,
  }

  const { data, isPending, isError } = useContacts(params)

  return (
    <div className="space-y-4">
      <ContactFilters />

      {isPending && <p className="text-muted-foreground">Loading contacts…</p>}
      {isError && <p className="text-red-500">Failed to load contacts. Please try again.</p>}
      {data && (
        <ContactTable
          data={data.results}
          count={data.count}
          page={params.page ?? 1}
          pageSize={params.page_size ?? 25}
        />
      )}
    </div>
  )
}
