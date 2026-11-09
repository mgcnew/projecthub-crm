import { lintMessage, lintTemplate, type LintCode } from './lint'

const codes = (w: { code: LintCode }[]) => w.map((x) => x.code)
const email1 = (text: string, subject = 'Ideia') => lintMessage({ channel: 'email', step: 1, text, subject })

describe('lintMessage', () => {
  it('mensagem curta e humana não tem avisos', () => {
    expect(email1('Oi Maria, vi que vocês fazem entrega no bairro. Faz sentido conversar sobre pedidos?')).toEqual([])
  })

  it.each([
    ['e-mail longo no passo 1', () => lintMessage({ channel: 'email', step: 1, text: 'a'.repeat(601) }), 'length'],
    ['e-mail no limite não avisa', () => lintMessage({ channel: 'email', step: 1, text: 'a'.repeat(600) }), null],
    ['WhatsApp longo no passo 1', () => lintMessage({ channel: 'whatsapp', step: 1, text: 'a'.repeat(301) }), 'length'],
    ['lembrete longo (passo 2)', () => lintMessage({ channel: 'email', step: 2, text: 'a'.repeat(401) }), 'length'],
    ['link no passo 1', () => email1('Veja https://exemplo.com'), 'link'],
    ['www no passo 1', () => email1('Veja www.exemplo.com'), 'link'],
    ['link no passo 2 é permitido', () => lintMessage({ channel: 'email', step: 2, text: 'Veja https://exemplo.com' }), null],
    ['duas perguntas', () => email1('Tudo bem? Posso ligar?'), 'questions'],
    ['uma pergunta', () => email1('Tudo bem?'), null],
    ['clichê', () => email1('Espero que esteja bem. Venho por meio desta apresentar.'), 'cliche'],
    ['clichê com caixa alta', () => email1('SOLUÇÃO INOVADORA para você'), 'cliche'],
    ['emojis demais', () => email1('Oi 😀😀😀'), 'emoji'],
    ['dois emojis ok', () => email1('Oi 😀😀'), null],
    ['exclamações demais', () => email1('Oi! Veja! Agora!'), 'exclamation'],
  ])('%s', (_name, run, expected) => {
    const found = codes(run())
    if (expected === null) expect(found).toEqual([])
    else expect(found).toContain(expected)
  })

  it('avisa placeholders sem valor e desconhecidos', () => {
    const w = lintMessage({ channel: 'email', step: 1, text: 'ok', missing: ['gancho', 'demo'], unknown: ['nome'] })
    expect(codes(w)).toEqual(['missing', 'missing', 'unknown'])
    expect(w[0].message).toContain('gancho')
    expect(w[1].message).toContain('link de demonstração')
  })

  it('o link no assunto também conta no passo 1', () => {
    expect(codes(lintMessage({ channel: 'email', step: 1, text: 'ok', subject: 'veja https://x.com' }))).toContain('link')
  })
})

describe('lintTemplate', () => {
  const base = { channel: 'email' as const, step: 1, subject: 'Ideia', body: 'Vi {{gancho}}. Faz sentido?', openings: ['Oi, {{contato}}'], closings: ['Abraço'] }
  it('modelo bom não tem avisos', () => {
    expect(lintTemplate(base)).toEqual([])
  })
  it('usa o pior caso: corpo + maior abertura + maior fechamento', () => {
    const w = lintTemplate({ ...base, body: 'a'.repeat(500), openings: ['b'.repeat(80), 'c'], closings: ['d'.repeat(80)] })
    expect(codes(w)).toContain('length')
  })
  it('placeholder inexistente e {{demo}} no passo 1', () => {
    expect(codes(lintTemplate({ ...base, body: 'Oi {{nome}}' }))).toContain('unknown')
    expect(codes(lintTemplate({ ...base, body: 'Veja {{demo}}' }))).toContain('demo-step1')
    expect(codes(lintTemplate({ ...base, step: 2, body: 'Veja {{demo}}' }))).not.toContain('demo-step1')
  })
  it('aceita {{abertura}} e {{fechamento}}', () => {
    expect(lintTemplate({ ...base, body: '{{abertura}} Vi {{gancho}}? {{fechamento}}' })).toEqual([])
  })
})
