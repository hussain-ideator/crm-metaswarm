export interface Company {
  id: number
  name: string
  industry: string
  website: string
  phone: string
  billing_address: string
  shipping_address: string
  annual_revenue: string | null
  employee_count: number | null
  owner: number | null
  created_at: string
  updated_at: string
  created_by: number | null
}

export interface CompanyListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Company[]
}

export interface CompanyListParams {
  q?: string
  industry?: string
  owner?: number
  ordering?: string
  page?: number
  page_size?: number
}
