import { eligibility, leadAddress, splitEligible, type QueueLead } from './queue'

const lead = (id: string, extra: Partial<QueueLead> = {}): QueueLead => ({
  id,
  company_name: `Empresa ${id}`,
  contact_name: null,
  email: `${id}@ex.com`,
  phone: '+5511912345678',
  hook: null,
  temperature: 'cold',
  product_id: null,
  opted_out_at: null,
  archived_at: null,
  ...extra,
})
const none = new Set<string>()
const email = { channel: 'email' as const, temperature: null }
const zap = { channel: 'whatsapp' as const, temperature: 'warm' }

describe('eligibility', () => {
  it('lead frio recebe e-mail; WhatsApp só morno e quente', () => {
    expect(eligibility({ template: email, lead: lead('a'), suppressed: none, queued: none })).toEqual({ ok: true })
    expect(eligibility({ template: { channel: 'whatsapp', temperature: null }, lead: lead('a'), suppressed: none, queued: none })).toEqual({ ok: false, reason: 'temperatura' })
    expect(eligibility({ template: { channel: 'whatsapp', temperature: null }, lead: lead('a', { temperature: 'hot' }), suppressed: none, queued: none })).toEqual({ ok: true })
  })

  it('o público do modelo restringe a temperatura', () => {
    expect(eligibility({ template: zap, lead: lead('a', { temperature: 'hot' }), suppressed: none, queued: none })).toEqual({ ok: false, reason: 'temperatura' })
    expect(eligibility({ template: zap, lead: lead('a', { temperature: 'warm' }), suppressed: none, queued: none })).toEqual({ ok: true })
  })

  it.each([
    ['arquivado', { archived_at: '2026-01-01' }, 'arquivado'],
    ['não contatar', { opted_out_at: '2026-01-01' }, 'nao-contatar'],
    ['sem e-mail', { email: null }, 'sem-contato'],
    ['e-mail em branco', { email: '  ' }, 'sem-contato'],
  ])('descarta lead %s', (_n, extra, reason) => {
    expect(eligibility({ template: email, lead: lead('a', extra), suppressed: none, queued: none })).toEqual({ ok: false, reason })
  })

  it('descarta endereço suprimido (sem diferença de caixa) e lead que já está na fila', () => {
    expect(eligibility({ template: email, lead: lead('a', { email: 'A@Ex.com' }), suppressed: new Set(['a@ex.com']), queued: none })).toEqual({ ok: false, reason: 'suprimido' })
    expect(eligibility({ template: email, lead: lead('a'), suppressed: none, queued: new Set(['a']) })).toEqual({ ok: false, reason: 'ja-na-fila' })
  })

  it('WhatsApp sem telefone é descartado', () => {
    expect(eligibility({ template: zap, lead: lead('a', { temperature: 'warm', phone: null }), suppressed: none, queued: none })).toEqual({ ok: false, reason: 'sem-contato' })
  })
})

describe('splitEligible / leadAddress', () => {
  it('separa elegíveis e conta os motivos', () => {
    const r = splitEligible({
      template: email,
      leads: [lead('a'), lead('b', { email: null }), lead('c', { archived_at: 'x' }), lead('d'), lead('e', { email: null })],
      suppressed: none,
      queued: new Set(['d']),
    })
    expect(r.eligible.map((l) => l.id)).toEqual(['a'])
    expect(Object.fromEntries(r.skipped)).toEqual({ 'sem-contato': 2, arquivado: 1, 'ja-na-fila': 1 })
  })
  it('leadAddress normaliza o e-mail', () => {
    expect(leadAddress('email', { email: ' Ana@Ex.COM ', phone: null })).toBe('ana@ex.com')
    expect(leadAddress('whatsapp', { email: null, phone: '+5511999999999' })).toBe('+5511999999999')
    expect(leadAddress('whatsapp', { email: 'x@y.com', phone: null })).toBeNull()
  })
})
