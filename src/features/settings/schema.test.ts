import { emailChangeSchema, profileSchema, workspaceSchema } from './schema'

describe('schemas das configurações', () => {
  it('o nome é aparado e obrigatório (até 120 caracteres)', () => {
    expect(profileSchema.parse({ display_name: '  Maria  ' }).display_name).toBe('Maria')
    expect(profileSchema.safeParse({ display_name: '   ' }).success).toBe(false)
    expect(profileSchema.safeParse({ display_name: 'a'.repeat(121) }).success).toBe(false)
    expect(workspaceSchema.safeParse({ name: '' }).success).toBe(false)
    expect(workspaceSchema.safeParse({ name: 'Estúdio' }).success).toBe(true)
  })
  it('o novo e-mail precisa ser um e-mail', () => {
    expect(emailChangeSchema.parse({ email: ' a@b.com ' }).email).toBe('a@b.com')
    expect(emailChangeSchema.safeParse({ email: 'invalido' }).success).toBe(false)
    expect(emailChangeSchema.safeParse({ email: '' }).success).toBe(false)
  })
})
