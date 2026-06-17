import { authFetch } from '@/lib/api'
import type { Contact, ContactListParams, ContactListResponse } from './types'
import type { ContactFormValues } from './schemas/contact'

function toQueryString(params: ContactListParams): string {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.company !== undefined) sp.set('company', String(params.company))
  if (params.owner !== undefined) sp.set('owner', String(params.owner))
  if (params.ordering) sp.set('ordering', params.ordering)
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const listContacts = (params: ContactListParams = {}): Promise<ContactListResponse> =>
  authFetch(`/api/contacts/${toQueryString(params)}`)

export const getContact = (id: number): Promise<Contact> =>
  authFetch(`/api/contacts/${id}/`)

export const createContact = (data: ContactFormValues): Promise<Contact> =>
  authFetch('/api/contacts/', { method: 'POST', body: JSON.stringify(data) })

export const updateContact = (id: number, data: ContactFormValues): Promise<Contact> =>
  authFetch(`/api/contacts/${id}/`, { method: 'PUT', body: JSON.stringify(data) })

export const patchContact = (id: number, data: Partial<ContactFormValues>): Promise<Contact> =>
  authFetch(`/api/contacts/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteContact = (id: number): Promise<void> =>
  authFetch(`/api/contacts/${id}/`, { method: 'DELETE' })
