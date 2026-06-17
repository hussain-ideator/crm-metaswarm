'use client'

import Link from 'next/link'
import { use } from 'react'
import { DeleteContactButton } from '@/features/contacts/components/DeleteContactButton'
import { useContact } from '@/features/contacts/hooks/useContact'

interface ContactDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = use(params)
  const contactId = Number(id)
  const { data: contact, isPending, isError } = useContact(contactId)

  if (isPending) return <p className="text-muted-foreground">Loading…</p>
  if (isError || !contact) return <p className="text-red-500">Contact not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/contacts" className="text-sm text-muted-foreground hover:text-foreground">
            ← Contacts
          </Link>
          <h1 className="text-2xl font-bold">
            {contact.first_name} {contact.last_name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/contacts/${contact.id}/edit`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Edit
          </Link>
          <DeleteContactButton id={contact.id} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-6">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Email</dt>
          <dd className="mt-1 text-sm">{contact.email || '—'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
          <dd className="mt-1 text-sm">{contact.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Title</dt>
          <dd className="mt-1 text-sm">{contact.title || '—'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Company</dt>
          <dd className="mt-1 text-sm">
            {contact.company ? (
              <Link
                href={`/companies/${contact.company.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {contact.company.name}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Owner</dt>
          <dd className="mt-1 text-sm">{contact.owner?.full_name || '—'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Created</dt>
          <dd className="mt-1 text-sm">{new Date(contact.created_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Updated</dt>
          <dd className="mt-1 text-sm">{new Date(contact.updated_at).toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  )
}
