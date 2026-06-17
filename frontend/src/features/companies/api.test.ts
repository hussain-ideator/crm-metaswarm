import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiLib from '@/lib/api'

vi.mock('@/store/auth', () => ({
  useAuthStore: { getState: () => ({ token: 'test-token' }) },
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof apiLib>()
  return { ...actual, authFetch: vi.fn() }
})

describe('companies/api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listCompanies calls authFetch with correct path', async () => {
    const { listCompanies } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({ count: 0, results: [], next: null, previous: null })
    await listCompanies({ q: 'test', page: 2 })
    expect(apiLib.authFetch).toHaveBeenCalledWith(expect.stringContaining('q=test'))
    expect(apiLib.authFetch).toHaveBeenCalledWith(expect.stringContaining('page=2'))
  })

  it('getCompany calls correct endpoint', async () => {
    const { getCompany } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({ id: 1, name: 'Test' })
    await getCompany(1)
    expect(apiLib.authFetch).toHaveBeenCalledWith('/api/companies/1/')
  })

  it('createCompany posts data', async () => {
    const { createCompany } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({ id: 1, name: 'New' })
    await createCompany({ name: 'New' } as never)
    expect(apiLib.authFetch).toHaveBeenCalledWith(
      '/api/companies/',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('deleteCompany calls DELETE', async () => {
    const { deleteCompany } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue(undefined)
    await deleteCompany(5)
    expect(apiLib.authFetch).toHaveBeenCalledWith(
      '/api/companies/5/',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
