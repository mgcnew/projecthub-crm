import { describe, expect, it } from 'vitest'
import {
  documentDefaults,
  documentFormSchema,
  documentPayload,
  interactionFormSchema,
  interactionPayload,
  nextContactSchema,
} from './schema'

describe('interações', () => {
  const ok = { kind: 'call' as const, occurred_at: '2026-11-03T14:30', contact_id: '', summary: 'Alinhou prazo' }

  it('exige o resumo e a data', () => {
    expect(interactionFormSchema.safeParse(ok).success).toBe(true)
    expect(interactionFormSchema.safeParse({ ...ok, summary: '   ' }).success).toBe(false)
    expect(interactionFormSchema.safeParse({ ...ok, occurred_at: '' }).success).toBe(false)
  })

  it('o payload converte a hora local para instante e vazio para null', () => {
    const p = interactionPayload(ok)
    expect(p.contact_id).toBeNull()
    expect(p.occurred_at).toMatch(/^2026-11-03T\d{2}:30:00\.000Z$/)
  })
})

describe('documentos', () => {
  it('exige título e link http(s)', () => {
    expect(documentFormSchema.safeParse(documentDefaults).success).toBe(false)
    const base = { ...documentDefaults, title: 'Contrato', url: 'https://drive.google.com/x' }
    expect(documentFormSchema.safeParse(base).success).toBe(true)
    expect(documentFormSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false)
    expect(documentFormSchema.safeParse({ ...base, url: 'drive.google.com/x' }).success).toBe(false)
  })

  it('payload', () => {
    expect(documentPayload({ ...documentDefaults, title: ' T ', url: ' https://a.com ' })).toEqual({
      title: 'T',
      url: 'https://a.com',
      kind: 'other',
      project_id: null,
      notes: null,
    })
  })
})

describe('próximo contato', () => {
  it('aceita data ou vazio', () => {
    expect(nextContactSchema.safeParse({ next_contact_on: '', next_contact_note: '' }).success).toBe(true)
    expect(nextContactSchema.safeParse({ next_contact_on: '2026-11-20', next_contact_note: 'x' }).success).toBe(true)
    expect(nextContactSchema.safeParse({ next_contact_on: '20/11/2026', next_contact_note: '' }).success).toBe(false)
  })
})
