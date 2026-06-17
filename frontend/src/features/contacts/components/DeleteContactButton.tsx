'use client'

import { useRouter } from 'next/navigation'
import { useDeleteContact } from '../hooks/useDeleteContact'

interface DeleteContactButtonProps {
  id: number
}

export function DeleteContactButton({ id }: DeleteContactButtonProps) {
  const router = useRouter()
  const { mutate, isPending } = useDeleteContact()

  const handleDelete = () => {
    if (!confirm('Delete this contact? This cannot be undone.')) return
    mutate(id, {
      onSuccess: () => router.push('/contacts'),
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
