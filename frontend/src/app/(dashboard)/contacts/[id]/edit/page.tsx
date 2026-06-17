'use client'

import Link from 'next/link'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ContactForm } from '@/features/contacts/components/ContactForm'
import { useContact } from '@/features/contacts/hooks/useContact'
import { useUpdateContact } from '@/features/contacts/hooks/useUpdateContact'
import type { ContactFormValues } from '@/features/contacts/schemas/contact'

interface EditContactPageProps {
  params: Promise<{ id: string }>
}

export default function EditContactPage({ params }: EditContactPageProps) {
  const { id } = use(params)
  const contactId = Number(id)
  const router = useRouter()
  const { data: contact, isPending } = useContact(contactId)
  const { mutateAsync } = useUpdateContact(contactId)

  const handleSubmit = async (data: ContactFormValues) => {
    await mutateAsync(data)
    router.push(`/contacts/${contactId}`)
  }

  if (isPending) return <p className="text-muted-foreground">Loading…</p>
  if (!contact) return <p className="text-red-500">Contact not found.</p>

  const defaultValues: Partial<ContactFormValues> = {
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    company_id: contact.company_id ?? undefined,
    owner_id: contact.owner_id ?? undefined,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/contacts/${contactId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {contact.first_name} {contact.last_name}
        </Link>
        <h1 className="text-2xl font-bold">Edit Contact</h1>
      </div>
      <ContactForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  )
}
