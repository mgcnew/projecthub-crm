import { describe, expect, it } from 'vitest'
import { codeSchema, newPasswordSchema, recoverSchema } from './passwordSchema'

describe('passwordSchema', () => {
  const ok = { password: 'Senha-Forte-123', confirm: 'Senha-Forte-123' }
  it('aceita senha forte e confirmada', () => {
    expect(newPasswordSchema.safeParse(ok).success).toBe(true)
  })
  it.each([
    ['curta', { password: 'Aa1', confirm: 'Aa1' }],
    ['sem maiúscula', { password: 'senha-forte-123', confirm: 'senha-forte-123' }],
    ['sem minúscula', { password: 'SENHA-FORTE-123', confirm: 'SENHA-FORTE-123' }],
    ['sem dígito', { password: 'Senha-Forte-abc', confirm: 'Senha-Forte-abc' }],
    ['não confere', { password: 'Senha-Forte-123', confirm: 'Senha-Forte-124' }],
  ])('rejeita senha %s', (_n, v) => {
    expect(newPasswordSchema.safeParse(v).success).toBe(false)
  })
  it('valida e-mail e código de 6 dígitos', () => {
    expect(recoverSchema.safeParse({ email: 'x' }).success).toBe(false)
    expect(recoverSchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
    expect(codeSchema.safeParse({ code: '12345' }).success).toBe(false)
    expect(codeSchema.safeParse({ code: '12a456' }).success).toBe(false)
    expect(codeSchema.safeParse({ code: '123456' }).success).toBe(true)
  })
})
