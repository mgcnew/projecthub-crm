// @vitest-environment node
import { buildMessages, deepseekProvider, fakeDraftProvider, handleDraftMessage, maxChars, noneProvider, parseDraft, STYLE_GUIDE, type DraftContext, type DraftDb, type DraftRequestContext } from './draft.ts'
import type { FetchLike } from './providers.ts'

const ORG = '11111111-1111-4111-8111-111111111111'
const LEAD = '22222222-2222-4222-8222-222222222222'
const TPL = '33333333-3333-4333-8333-333333333333'
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

const ctx: DraftContext = {
  channel: 'email',
  step: 1,
  lead: { company_name: 'Padaria Sol', contact_first_name: 'Ana', hook: 'vi o cardápio no Instagram', segment: 'Padaria', city: 'Campinas' },
  product: { name: 'Voltier Pedidos', value_proposition: 'organiza encomendas' },
  reference: { subject: 'Uma ideia', body: 'Oi {{nome}}' },
}

describe('rascunho com IA: montagem e leitura', () => {
  it('monta o prompt só com dados de negócio (sem e-mail nem telefone) e com o limite do canal', () => {
    const m = buildMessages(ctx)
    expect(m[0].role).toBe('system')
    expect(m[0].content).toContain(String(maxChars('email', 1)))
    expect(m[0].content).toBe(STYLE_GUIDE.replace('{{max}}', '600'))
    const user = m[1].content
    expect(user).toContain('Padaria Sol')
    expect(user).toContain('Ana')
    expect(user).toContain('vi o cardápio no Instagram')
    expect(user).not.toMatch(/@|\d{8,}/)
  })

  it('sem contato nem gancho, manda a IA não inventar', () => {
    const user = buildMessages({ ...ctx, lead: { ...ctx.lead, contact_first_name: null, hook: null } })[1].content
    expect(user).toContain('não invente')
    expect(user).toContain('Gancho: não informado')
  })

  it('parseDraft aceita JSON dentro de cerca de código e exige assunto no e-mail', () => {
    expect(parseDraft('```json\n{"subject":" Oi ","body":" Texto "}\n```', 'email')).toEqual({ subject: 'Oi', body: 'Texto' })
    expect(parseDraft('{"body":"Texto"}', 'email')).toBeNull()
    expect(parseDraft('{"subject":"x","body":"Texto"}', 'whatsapp')).toEqual({ subject: null, body: 'Texto' })
    expect(parseDraft('sem json', 'email')).toBeNull()
    expect(parseDraft('{"subject":"x","body":""}', 'email')).toBeNull()
  })
})

describe('DeepSeek (fetch simulado)', () => {
  it('chama a API com a chave no cabeçalho e devolve o rascunho', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const f: FetchLike = async (url, init) => {
      seen = { url, init: init! }
      return jsonRes(200, { choices: [{ message: { content: '{"subject":"Uma ideia","body":"Oi Ana, vi o cardápio. Posso mostrar um exemplo?"}' } }] })
    }
    const r = await deepseekProvider('sk-teste', f).generate(ctx)
    expect(r).toEqual({ ok: true, subject: 'Uma ideia', body: 'Oi Ana, vi o cardápio. Posso mostrar um exemplo?' })
    expect(seen!.url).toBe('https://api.deepseek.com/chat/completions')
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-teste')
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({ model: 'deepseek-chat', response_format: { type: 'json_object' } })
  })

  it('429/5xx e rede valem nova tentativa; resposta inválida também; 401 não', async () => {
    expect(await deepseekProvider('k', async () => jsonRes(429, {})).generate(ctx)).toMatchObject({ ok: false, retry: true })
    expect(await deepseekProvider('k', async () => jsonRes(500, {})).generate(ctx)).toMatchObject({ ok: false, retry: true })
    expect(await deepseekProvider('k', async () => jsonRes(401, {})).generate(ctx)).toMatchObject({ ok: false, retry: false })
    expect(await deepseekProvider('k', async () => { throw new Error('x') }).generate(ctx)).toMatchObject({ ok: false, retry: true })
    expect(await deepseekProvider('k', async () => jsonRes(200, { choices: [{ message: { content: 'oi' } }] })).generate(ctx)).toMatchObject({ ok: false })
  })

  it('o provedor "none" nunca gera nada', async () => {
    expect(await noneProvider.generate(ctx)).toMatchObject({ ok: false, retry: false })
  })
})

function fakeDb(over: Partial<{ provider: string; limit: number; used: number; context: DraftRequestContext | null; insert: { id: string } | { error: string } }> = {}) {
  const inserted: unknown[] = []
  const db: DraftDb = {
    settings: async () => ({ organization_id: ORG, draft_provider: over.provider ?? 'deepseek', ai_daily_limit: over.limit ?? 20 }),
    aiCount: async () => over.used ?? 0,
    context: async () => (over.context === undefined ? { organization_id: ORG, template_id: TPL, ...ctx } : over.context),
    insertDraft: async (i) => {
      inserted.push(i)
      return over.insert ?? { id: 'draft-1' }
    },
  }
  return { db, inserted }
}
const post = (body: unknown) => new Request('https://x/draft-message', { method: 'POST', body: JSON.stringify(body) })

describe('handleDraftMessage', () => {
  it('desligada: 409 e a IA nem é chamada', async () => {
    const { db } = fakeDb({ provider: 'none' })
    const p = fakeDraftProvider()
    const res = await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db, provider: p })
    expect(res.status).toBe(409)
    expect(p.calls).toHaveLength(0)
  })

  it('ligada: gera, grava o rascunho e devolve o id', async () => {
    const { db, inserted } = fakeDb()
    const p = fakeDraftProvider()
    const res = await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db, provider: p })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'draft-1' })
    expect(inserted).toEqual([expect.objectContaining({ orgId: ORG, leadId: LEAD, templateId: TPL, channel: 'email' })])
    expect(p.calls).toHaveLength(1)
  })

  it('limite diário atingido: 429 sem chamar a IA; o dia conta em UTC', async () => {
    const { db } = fakeDb({ used: 20, limit: 20 })
    const p = fakeDraftProvider()
    const res = await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db, provider: p, now: () => new Date('2026-11-09T15:30:00Z') })
    expect(res.status).toBe(429)
    expect(p.calls).toHaveLength(0)
  })

  it('lead ou modelo de outra organização: 404; sem IA configurada no servidor: 409', async () => {
    const other = fakeDb({ context: { organization_id: '99999999-9999-4999-8999-999999999999', template_id: TPL, ...ctx } })
    expect((await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db: other.db, provider: fakeDraftProvider() })).status).toBe(404)
    const none = fakeDb()
    expect((await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db: none.db, provider: noneProvider })).status).toBe(409)
    expect(none.inserted).toHaveLength(0)
  })

  it('falha da IA com nova tentativa: 502; banco barrou (supressão/regra): 422; entrada inválida: 400; método: 405', async () => {
    const a = fakeDb()
    expect((await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db: a.db, provider: fakeDraftProvider({ ok: false, error: 'x', retry: true }) })).status).toBe(502)
    const b = fakeDb({ insert: { error: 'lead suprimido' } })
    expect((await handleDraftMessage(post({ leadId: LEAD, templateId: TPL }), { db: b.db, provider: fakeDraftProvider() })).status).toBe(422)
    expect((await handleDraftMessage(post({ leadId: 'x', templateId: TPL }), { db: a.db, provider: fakeDraftProvider() })).status).toBe(400)
    expect((await handleDraftMessage(new Request('https://x', { method: 'GET' }), { db: a.db, provider: fakeDraftProvider() })).status).toBe(405)
  })
})
