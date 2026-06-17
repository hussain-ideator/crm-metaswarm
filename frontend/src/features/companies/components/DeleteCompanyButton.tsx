'use client'

import { useRouter } from 'next/navigation'
import { useDeleteCompany } from '../hooks/useDeleteCompany'

interface DeleteCompanyButtonProps {
  id: number
}

export function DeleteCompanyButton({ id }: DeleteCompanyButtonProps) {
  const router = useRouter()
  const { mutate, isPending } = useDeleteCompany()

  const handleDelete = () => {
    if (!confirm('Delete this company? This cannot be undone.')) return
    mutate(id, {
      onSuccess: () => router.push('/companies'),
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
