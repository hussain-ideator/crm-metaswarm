import { useQuery } from '@tanstack/react-query'
import { listContacts } from '../api'
import type { ContactListParams } from '../types'

export function useContacts(params: ContactListParams = {}) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: () => listContacts(params),
  })
}
