import { describe, expect, it } from 'vitest'
import { leadDefaults, leadErrorMessage, leadFormSchema, leadPayload } from './schema'

const base = { ...leadDefaults, company_name: 'Padaria Sol', source: 'Planilha' }

describe('leadFormSchema', () => {
  it('exige empresa e origem', () => {
    expect(leadFormSchema.safeParse(leadDefaults).success).toBe(false)
    expect(leadFormSchema.safeParse({ ...leadDefaults, company_name: 'X' }).success).toBe(false)
    expect(leadFormSchema.safeParse(base).success).toBe(true)
  })

  it('valida telefone, e-mail e site', () => {
    expect(leadFormSchema.safeParse({ ...base, phone: '1234' }).success).toBe(false)
    expect(leadFormSchema.safeParse({ ...base, phone: '(11) 91234-5678' }).success).toBe(true)
    expect(leadFormSchema.safeParse({ ...base, email: 'x' }).success).toBe(false)
    expect(leadFormSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(false)
  })
})

describe('leadPayload', () => {
  it('normaliza telefone e e-mail e troca vazio por null', () => {
    const p = leadPayload({ ...base, phone: '(11) 91234-5678', email: 'Contato@Sol.com' })
    expect(p.phone).toBe('+5511912345678')
    expect(p.email).toBe('contato@sol.com')
    expect(p.contact_name).toBeNull()
    expect(p.next_contact_on).toBeNull()
  })

  it('motivo da perda só fica em "Perdido"', () => {
    expect(leadPayload({ ...base, stage: 'replied', lost_reason: 'caro' }).lost_reason).toBeNull()
    expect(leadPayload({ ...base, stage: 'lost', lost_reason: 'caro' }).lost_reason).toBe('caro')
  })
})

describe('leadErrorMessage', () => {
  it('traduz duplicados', () => {
    expect(leadErrorMessage({ code: '23505', message: 'violates unique constraint "leads_org_email_key"' })).toMatch(/e-mail/)
    expect(leadErrorMessage({ code: '23505', message: 'violates unique constraint "leads_org_phone_key"' })).toMatch(/telefone/)
    expect(leadErrorMessage({ code: '42501' })).toMatch(/Não foi possível/)
  })
})
