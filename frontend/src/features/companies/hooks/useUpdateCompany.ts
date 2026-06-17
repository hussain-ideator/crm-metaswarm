import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchCompany } from '../api'
import type { CompanyFormValues } from '../schemas/company'

export function useUpdateCompany(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CompanyFormValues>) => patchCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['companies', id] })
    },
  })
}
