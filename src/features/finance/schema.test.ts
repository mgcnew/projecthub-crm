import { describe, expect, it } from 'vitest'
import { generatorSchema, paymentDefaults, paymentFormSchema, paymentPayload } from './schema'

describe('paymentFormSchema', () => {
  const ok = { ...paymentDefaults('2026-11-10'), amount: '1.500,00' }

  it('aceita valor em formato brasileiro e converte para centavos', () => {
    expect(paymentFormSchema.safeParse(ok).success).toBe(true)
    expect(paymentPayload(ok).amount_cents).toBe(150000)
  })

  it.each([[''], ['0'], ['0,00'], ['abc'], ['10,999'], ['-5']])('rejeita o valor "%s"', (amount) => {
    expect(paymentFormSchema.safeParse({ ...ok, amount }).success).toBe(false)
  })

  it('exige a data de vencimento', () => {
    expect(paymentFormSchema.safeParse({ ...ok, due_date: '' }).success).toBe(false)
  })

  it('vazio vira null no payload', () => {
    const p = paymentPayload({ ...ok, description: '  ', notes: '' })
    expect(p.description).toBeNull()
    expect(p.notes).toBeNull()
  })
})

describe('generatorSchema', () => {
  const base = { total: '5.000,00', advance_percent: '30', installments: '3', advance_due: '2026-11-01', first_due: '2026-12-01' }
  it('valida', () => {
    expect(generatorSchema.safeParse(base).success).toBe(true)
    expect(generatorSchema.safeParse({ ...base, advance_percent: '' }).success).toBe(true)
    expect(generatorSchema.safeParse({ ...base, advance_percent: '101' }).success).toBe(false)
    expect(generatorSchema.safeParse({ ...base, installments: '0' }).success).toBe(false)
    expect(generatorSchema.safeParse({ ...base, installments: '61' }).success).toBe(false)
    expect(generatorSchema.safeParse({ ...base, total: '' }).success).toBe(false)
  })
})
