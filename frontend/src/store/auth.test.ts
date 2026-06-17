import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth'

const testUser = { id: 1, email: 'test@example.com', first_name: 'Test', last_name: 'User' }

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('starts with no auth', () => {
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setAuth stores token and user', () => {
    useAuthStore.getState().setAuth('tok123', testUser)
    expect(useAuthStore.getState().token).toBe('tok123')
    expect(useAuthStore.getState().user).toEqual(testUser)
  })

  it('logout clears token and user', () => {
    useAuthStore.setState({ token: 'tok', user: testUser })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
