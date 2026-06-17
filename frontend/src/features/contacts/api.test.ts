import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as apiLib from '@/lib/api'

vi.mock('@/store/auth', () => ({
  useAuthStore: { getState: () => ({ token: 'test-token' }) },
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof apiLib>()
  return { ...actual, authFetch: vi.fn() }
})

describe('contacts/api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listContacts calls authFetch with q param', async () => {
    const { listContacts } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({
      count: 0,
      results: [],
      next: null,
      previous: null,
    })
    await listContacts({ q: 'jane', page: 1 })
    expect(apiLib.authFetch).toHaveBeenCalledWith(expect.stringContaining('q=jane'))
  })

  it('listContacts passes company filter', async () => {
    const { listContacts } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({
      count: 0,
      results: [],
      next: null,
      previous: null,
    })
    await listContacts({ company: 5 })
    expect(apiLib.authFetch).toHaveBeenCalledWith(expect.stringContaining('company=5'))
  })

  it('getContact calls correct endpoint', async () => {
    const { getContact } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({ id: 1 })
    await getContact(1)
    expect(apiLib.authFetch).toHaveBeenCalledWith('/api/contacts/1/')
  })

  it('createContact posts data', async () => {
    const { createContact } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue({ id: 1 })
    await createContact({ first_name: 'Jane', last_name: 'Doe' } as never)
    expect(apiLib.authFetch).toHaveBeenCalledWith(
      '/api/contacts/',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('deleteContact calls DELETE', async () => {
    const { deleteContact } = await import('./api')
    vi.mocked(apiLib.authFetch).mockResolvedValue(undefined)
    await deleteContact(3)
    expect(apiLib.authFetch).toHaveBeenCalledWith(
      '/api/contacts/3/',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
