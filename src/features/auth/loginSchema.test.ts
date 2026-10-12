import { loginSchema } from './loginSchema'

describe('loginSchema', () => {
  it('aceita e-mail e senha', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })
  it('rejeita e-mail inválido e senha vazia', () => {
    const r = loginSchema.safeParse({ email: 'abc', password: '' })
    expect(r.success).toBe(false)
  })
})
