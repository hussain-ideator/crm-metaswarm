import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchContact } from '../api'
import type { ContactFormValues } from '../schemas/contact'

export function useUpdateContact(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ContactFormValues>) => patchContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contacts', id] })
    },
  })
}
