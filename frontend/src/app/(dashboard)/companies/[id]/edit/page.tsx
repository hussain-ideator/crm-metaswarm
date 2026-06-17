'use client'

import Link from 'next/link'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { CompanyForm } from '@/features/companies/components/CompanyForm'
import { useCompany } from '@/features/companies/hooks/useCompany'
import { useUpdateCompany } from '@/features/companies/hooks/useUpdateCompany'
import type { CompanyFormValues } from '@/features/companies/schemas/company'

interface EditCompanyPageProps {
  params: Promise<{ id: string }>
}

export default function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = use(params)
  const companyId = Number(id)
  const router = useRouter()
  const { data: company, isPending } = useCompany(companyId)
  const { mutateAsync } = useUpdateCompany(companyId)

  const handleSubmit = async (data: CompanyFormValues) => {
    await mutateAsync(data)
    router.push(`/companies/${companyId}`)
  }

  if (isPending) return <p className="text-muted-foreground">Loading…</p>
  if (!company) return <p className="text-red-500">Company not found.</p>

  const defaultValues: Partial<CompanyFormValues> = {
    name: company.name,
    industry: company.industry,
    website: company.website,
    phone: company.phone,
    billing_address: company.billing_address,
    shipping_address: company.shipping_address,
    annual_revenue: company.annual_revenue ?? '',
    employee_count: company.employee_count ?? undefined,
    owner: company.owner ?? undefined,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/companies/${companyId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {company.name}
        </Link>
        <h1 className="text-2xl font-bold">Edit Company</h1>
      </div>
      <CompanyForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  )
}
