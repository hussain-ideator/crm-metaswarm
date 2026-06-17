import { useQuery } from '@tanstack/react-query'
import { getCompany } from '../api'

export function useCompany(id: number) {
  return useQuery({
    queryKey: ['companies', id],
    queryFn: () => getCompany(id),
    enabled: !!id,
  })
}
