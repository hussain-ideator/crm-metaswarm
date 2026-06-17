import { useQuery } from '@tanstack/react-query'
import { getContact } from '../api'

export function useContact(id: number) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => getContact(id),
    enabled: !!id,
  })
}
