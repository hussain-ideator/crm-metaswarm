import { describe, expect, it } from 'vitest'
import { contactSchema } from './contact'

describe('contactSchema', () => {
  it('accepts valid first and last name', () => {
    const result = contactSchema.safeParse({ first_name: 'Jane', last_name: 'Doe' })
    expect(result.success).toBe(true)
  })

  it('rejects empty first_name', () => {
    const result = contactSchema.safeParse({ first_name: '', last_name: 'Doe' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('first_name')
    }
  })

  it('rejects missing first_name', () => {
    const result = contactSchema.safeParse({ last_name: 'Doe' })
    expect(result.success).toBe(false)
  })

  it('rejects empty last_name', () => {
    const result = contactSchema.safeParse({ first_name: 'Jane', last_name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts missing optional fields', () => {
    const result = contactSchema.safeParse({ first_name: 'Jane', last_name: 'Doe' })
    expect(result.success).toBe(true)
  })

  it('accepts valid email', () => {
    const result = contactSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = contactSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null company_id', () => {
    const result = contactSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Doe',
      company_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts numeric company_id', () => {
    const result = contactSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Doe',
      company_id: 42,
    })
    expect(result.success).toBe(true)
  })
})
