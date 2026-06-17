'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContactForm } from '@/features/contacts/components/ContactForm'
import { useCreateContact } from '@/features/contacts/hooks/useCreateContact'
import type { ContactFormValues } from '@/features/contacts/schemas/contact'

export default function NewContactPage() {
  const router = useRouter()
  const { mutateAsync } = useCreateContact()

  const handleSubmit = async (data: ContactFormValues) => {
    const contact = await mutateAsync(data)
    router.push(`/contacts/${contact.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts" className="text-sm text-muted-foreground hover:text-foreground">
          ← Contacts
        </Link>
        <h1 className="text-2xl font-bold">New Contact</h1>
      </div>
      <ContactForm onSubmit={handleSubmit} submitLabel="Create Contact" />
    </div>
  )
}
