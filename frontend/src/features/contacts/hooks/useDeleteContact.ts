import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteContact } from '../api'

export function useDeleteContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
