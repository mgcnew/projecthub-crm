import { loginSchema } from './loginSchema'

describe('loginSchema', () => {
  it('aceita e-mail e senha', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', remember: true }).success).toBe(true)
  })
  it('rejeita e-mail inválido e senha vazia', () => {
    const r = loginSchema.safeParse({ email: 'abc', password: '', remember: false })
    expect(r.success).toBe(false)
  })
})
