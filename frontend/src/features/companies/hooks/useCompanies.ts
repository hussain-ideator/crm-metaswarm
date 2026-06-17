import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '../api'
import type { CompanyListParams } from '../types'

export function useCompanies(params: CompanyListParams = {}) {
  return useQuery({
    queryKey: ['companies', params],
    queryFn: () => listCompanies(params),
  })
}
