import { clientDefaults, clientFormSchema, clientPayload } from './schema'

describe('clientFormSchema', () => {
  it('exige nome', () => {
    expect(clientFormSchema.safeParse({ ...clientDefaults, name: '  ' }).success).toBe(false)
  })
  it('aceita e-mail vazio e rejeita e-mail inválido', () => {
    expect(clientFormSchema.safeParse({ ...clientDefaults, name: 'A', email: '' }).success).toBe(true)
    expect(clientFormSchema.safeParse({ ...clientDefaults, name: 'A', email: 'x' }).success).toBe(false)
  })
  it('converte vazios em null no payload', () => {
    expect(clientPayload({ ...clientDefaults, name: 'A' })).toMatchObject({ email: null, phone: null, notes: null })
  })
})
