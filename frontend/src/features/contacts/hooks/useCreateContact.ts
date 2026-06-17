import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createContact } from '../api'
import type { ContactFormValues } from '../schemas/contact'

export function useCreateContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ContactFormValues) => createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
