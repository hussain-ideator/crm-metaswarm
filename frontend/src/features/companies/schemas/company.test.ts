import { describe, expect, it } from 'vitest'
import { companySchema } from './company'

describe('companySchema', () => {
  it('accepts valid data with name only', () => {
    const result = companySchema.safeParse({ name: 'Acme Corp' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = companySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name')
    }
  })

  it('rejects missing name', () => {
    const result = companySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts valid annual_revenue', () => {
    const result = companySchema.safeParse({ name: 'Corp', annual_revenue: '1000.50' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid annual_revenue format', () => {
    const result = companySchema.safeParse({ name: 'Corp', annual_revenue: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects negative employee_count', () => {
    const result = companySchema.safeParse({ name: 'Corp', employee_count: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts zero employee_count', () => {
    const result = companySchema.safeParse({ name: 'Corp', employee_count: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer employee_count', () => {
    const result = companySchema.safeParse({ name: 'Corp', employee_count: 1.5 })
    expect(result.success).toBe(false)
  })
})
