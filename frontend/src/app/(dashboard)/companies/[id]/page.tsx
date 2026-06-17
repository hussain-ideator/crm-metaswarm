'use client'

import Link from 'next/link'
import { use } from 'react'
import { DeleteCompanyButton } from '@/features/companies/components/DeleteCompanyButton'
import { useCompany } from '@/features/companies/hooks/useCompany'

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>
}

export default function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = use(params)
  const companyId = Number(id)
  const { data: company, isPending, isError } = useCompany(companyId)

  if (isPending) return <p className="text-muted-foreground">Loading…</p>
  if (isError || !company) return <p className="text-red-500">Company not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">
            ← Companies
          </Link>
          <h1 className="text-2xl font-bold">{company.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/companies/${company.id}/edit`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Edit
          </Link>
          <DeleteCompanyButton id={company.id} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-6">
        {[
          ['Industry', company.industry],
          ['Website', company.website],
          ['Phone', company.phone],
          ['Annual Revenue', company.annual_revenue],
          ['Employees', company.employee_count],
          ['Billing Address', company.billing_address],
          ['Shipping Address', company.shipping_address],
          ['Created', new Date(company.created_at).toLocaleString()],
          ['Updated', new Date(company.updated_at).toLocaleString()],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
