import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCompany } from '../api'
import type { CompanyFormValues } from '../schemas/company'

export function useCreateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CompanyFormValues) => createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}
