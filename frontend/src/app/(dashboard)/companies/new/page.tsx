'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CompanyForm } from '@/features/companies/components/CompanyForm'
import { useCreateCompany } from '@/features/companies/hooks/useCreateCompany'
import type { CompanyFormValues } from '@/features/companies/schemas/company'

export default function NewCompanyPage() {
  const router = useRouter()
  const { mutateAsync } = useCreateCompany()

  const handleSubmit = async (data: CompanyFormValues) => {
    const company = await mutateAsync(data)
    router.push(`/companies/${company.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">
          ← Companies
        </Link>
        <h1 className="text-2xl font-bold">New Company</h1>
      </div>
      <CompanyForm onSubmit={handleSubmit} submitLabel="Create Company" />
    </div>
  )
}
