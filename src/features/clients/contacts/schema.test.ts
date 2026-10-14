import { describe, expect, it } from 'vitest'
import { contactDefaults, contactFormSchema, contactPayload } from './schema'

describe('contactFormSchema', () => {
  it('exige o nome e valida o e-mail', () => {
    expect(contactFormSchema.safeParse(contactDefaults).success).toBe(false)
    expect(contactFormSchema.safeParse({ ...contactDefaults, name: 'Ana' }).success).toBe(true)
    expect(contactFormSchema.safeParse({ ...contactDefaults, name: 'Ana', email: 'x' }).success).toBe(false)
    expect(contactFormSchema.safeParse({ ...contactDefaults, name: 'Ana', email: 'ana@acme.com' }).success).toBe(true)
  })

  it('o payload troca vazio por null e mantém o principal', () => {
    expect(contactPayload({ ...contactDefaults, name: ' Ana ', is_primary: true })).toEqual({
      name: 'Ana',
      role_title: null,
      email: null,
      phone: null,
      whatsapp: null,
      is_primary: true,
      notes: null,
    })
  })
})
