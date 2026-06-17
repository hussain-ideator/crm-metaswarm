import Link from 'next/link'
import { Suspense } from 'react'
import { CompaniesView } from './companies-view'

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Link
          href="/companies/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New Company
        </Link>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <CompaniesView />
      </Suspense>
    </div>
  )
}
