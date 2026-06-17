import Link from 'next/link'
import { Suspense } from 'react'
import { ContactsView } from './contacts-view'

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <Link
          href="/contacts/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New Contact
        </Link>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <ContactsView />
      </Suspense>
    </div>
  )
}
