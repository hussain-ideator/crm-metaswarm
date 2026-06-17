import { authFetch } from '@/lib/api'
import type { Company, CompanyListParams, CompanyListResponse } from './types'
import type { CompanyFormValues } from './schemas/company'

function toQueryString(params: CompanyListParams): string {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.industry) sp.set('industry', params.industry)
  if (params.owner !== undefined) sp.set('owner', String(params.owner))
  if (params.ordering) sp.set('ordering', params.ordering)
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const listCompanies = (params: CompanyListParams = {}): Promise<CompanyListResponse> =>
  authFetch(`/api/companies/${toQueryString(params)}`)

export const getCompany = (id: number): Promise<Company> =>
  authFetch(`/api/companies/${id}/`)

export const createCompany = (data: CompanyFormValues): Promise<Company> =>
  authFetch('/api/companies/', { method: 'POST', body: JSON.stringify(data) })

export const updateCompany = (id: number, data: CompanyFormValues): Promise<Company> =>
  authFetch(`/api/companies/${id}/`, { method: 'PUT', body: JSON.stringify(data) })

export const patchCompany = (id: number, data: Partial<CompanyFormValues>): Promise<Company> =>
  authFetch(`/api/companies/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteCompany = (id: number): Promise<void> =>
  authFetch(`/api/companies/${id}/`, { method: 'DELETE' })
