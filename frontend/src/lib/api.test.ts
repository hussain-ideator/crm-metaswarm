import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns parsed JSON on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    } as unknown as Response)

    const result = await apiFetch('/test')
    expect(result).toEqual({ data: 'ok' })
  })

  it('includes credentials and content-type headers', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as unknown as Response)

    await apiFetch('/test')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('throws with detail message on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Unauthorized' }),
    } as unknown as Response)

    await expect(apiFetch('/test')).rejects.toThrow('Unauthorized')
  })

  it('throws with HTTP status on error without detail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    } as unknown as Response)

    await expect(apiFetch('/test')).rejects.toThrow('HTTP 500')
  })
})
