import { hash32, pickVariation, placeholdersIn, renderMessage, tidy, type RenderLead, type RenderTemplate } from './render'

const lead = (id: string, extra: Partial<RenderLead> = {}): RenderLead => ({
  id,
  company_name: 'Padaria Sol',
  contact_name: 'Maria Souza',
  hook: 'que vocês fazem entrega no bairro',
  ...extra,
})
const product = { name: 'Sistema de pedidos', value_proposition: 'cardápio digital sem taxa por pedido', demo_url: 'https://demo.exemplo.com' }
const tpl = (extra: Partial<RenderTemplate> = {}): RenderTemplate => ({
  id: 'tpl-1',
  step: 1,
  subject: 'Uma ideia para a {{empresa}}',
  body: 'Vi {{gancho}}. O {{sistema}} traz {{proposta}}. Faz sentido conversar?',
  openings: [],
  closings: [],
  ...extra,
})

describe('renderMessage', () => {
  it('substitui os placeholders no assunto e no corpo', () => {
    const r = renderMessage({ template: tpl(), lead: lead('l1'), product })
    expect(r.subject).toBe('Uma ideia para a Padaria Sol')
    expect(r.body).toBe('Vi que vocês fazem entrega no bairro. O Sistema de pedidos traz cardápio digital sem taxa por pedido. Faz sentido conversar?')
    expect(r.missing).toEqual([])
    expect(r.unknown).toEqual([])
  })

  it('o mesmo lead sempre recebe o mesmo texto, em qualquer execução', () => {
    const t = tpl({ openings: ['Oi, {{contato}}', 'Olá, {{contato}}', 'E aí, {{contato}}'], closings: ['Abraço', 'Até mais'] })
    const a = renderMessage({ template: t, lead: lead('lead-xyz'), product })
    const b = renderMessage({ template: t, lead: lead('lead-xyz'), product })
    expect(a).toEqual(b)
  })

  it('leads diferentes recebem variações diferentes quando há variações', () => {
    const t = tpl({ openings: ['Oi, {{contato}}', 'Olá, {{contato}}', 'E aí, {{contato}}', 'Bom dia, {{contato}}'], closings: ['Abraço', 'Até mais', 'Obrigado'] })
    const openings = new Set<string>()
    const closings = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const r = renderMessage({ template: t, lead: lead(`lead-${i}`), product })
      openings.add(r.opening ?? '')
      closings.add(r.closing ?? '')
    }
    expect(openings.size).toBeGreaterThan(1)
    expect(closings.size).toBeGreaterThan(1)
  })

  it('a abertura vai antes e o fechamento depois, ou nos marcadores {{abertura}} e {{fechamento}}', () => {
    const solo = renderMessage({ template: tpl({ openings: ['Oi'], closings: ['Abraço'] }), lead: lead('a'), product })
    expect(solo.body.startsWith('Oi\n\nVi ')).toBe(true)
    expect(solo.body.endsWith('conversar?\n\nAbraço')).toBe(true)
    const marked = renderMessage({
      template: tpl({ body: '{{abertura}} Vi {{gancho}}. {{fechamento}}', openings: ['Oi'], closings: ['Abraço'] }),
      lead: lead('a'),
      product,
    })
    expect(marked.body).toBe('Oi Vi que vocês fazem entrega no bairro. Abraço')
  })

  it('sem nome do contato, {{contato}} vira "tudo bem?" sem vírgula sobrando', () => {
    const r = renderMessage({ template: tpl({ body: 'Olá {{contato}}, vi {{gancho}}.' }), lead: lead('a', { contact_name: null }), product })
    expect(r.body).toBe('Olá tudo bem? vi que vocês fazem entrega no bairro.')
    const named = renderMessage({ template: tpl({ body: 'Olá {{contato}}, vi {{gancho}}.' }), lead: lead('a'), product })
    expect(named.body).toBe('Olá Maria, vi que vocês fazem entrega no bairro.')
  })

  it('placeholder sem valor é avisado e o texto sai limpo', () => {
    const r = renderMessage({ template: tpl({ body: 'Vi {{gancho}}. Conheça o {{sistema}}.' }), lead: lead('a', { hook: null }), product })
    expect(r.missing).toEqual(['gancho'])
    expect(r.body).toBe('Vi. Conheça o Sistema de pedidos.')
    const noProduct = renderMessage({ template: tpl({ body: '{{sistema}}: {{proposta}}' }), lead: lead('a'), product: null })
    expect(noProduct.missing.sort()).toEqual(['proposta', 'sistema'])
  })

  it('{{demo}} só vale a partir do passo 2', () => {
    const first = renderMessage({ template: tpl({ step: 1, body: 'Veja: {{demo}}' }), lead: lead('a'), product })
    expect(first.demoBlocked).toBe(true)
    expect(first.body).toBe('Veja:')
    expect(first.missing).toEqual([])
    const second = renderMessage({ template: tpl({ step: 2, body: 'Veja: {{demo}}' }), lead: lead('a'), product })
    expect(second.body).toBe('Veja: https://demo.exemplo.com')
    const noUrl = renderMessage({ template: tpl({ step: 2, body: 'Veja: {{demo}}' }), lead: lead('a'), product: { ...product, demo_url: null } })
    expect(noUrl.missing).toEqual(['demo'])
  })

  it('aponta placeholders que não existem e os mantém no texto', () => {
    const r = renderMessage({ template: tpl({ body: 'Oi {{nome}}' }), lead: lead('a'), product })
    expect(r.unknown).toEqual(['nome'])
    expect(r.body).toBe('Oi {{nome}}')
  })
})

describe('apoio', () => {
  it('hash32 é estável e pickVariation ignora variações vazias', () => {
    expect(hash32('abc')).toBe(hash32('abc'))
    expect(hash32('abc')).not.toBe(hash32('abd'))
    expect(pickVariation(['  ', ''], 'l', 't', 'x')).toBeNull()
    expect(pickVariation(['só uma'], 'l', 't', 'x')).toBe('só uma')
  })
  it('tidy remove espaços duplos, espaço antes de pontuação e linhas vazias demais', () => {
    expect(tidy('Oi  mundo ,   tudo\n\n\n\nbem ?')).toBe('Oi mundo, tudo\n\nbem?')
  })
  it('placeholdersIn lista sem repetir', () => {
    expect(placeholdersIn('{{empresa}} e {{Empresa}} e {{ gancho }}')).toEqual(['empresa', 'gancho'])
  })
})
