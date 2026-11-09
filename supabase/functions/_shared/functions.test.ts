// @vitest-environment node
import { handleEvolutionWebhook, handleResendWebhook, handleSendOutbox, handleUnsubscribe, type Claimed, type OutboxDb, type WebhookDb } from './handlers.ts'
import { parseEvolutionEvent, parseResendEvent } from './events.ts'
import { evolutionProvider, fakeEmailProvider, fakeWhatsAppProvider, resendProvider, type FetchLike } from './providers.ts'
import { verifySvix } from './svix.ts'
import { signUnsubscribe, verifyUnsubscribe } from './unsubscribe.ts'

const ORG = '11111111-1111-4111-8111-111111111111'
const LEAD = '22222222-2222-4222-8222-222222222222'
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('provedores de e-mail e WhatsApp (fetch simulado)', () => {
  it('Resend: envia texto simples com cabeçalhos e devolve o id', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const f: FetchLike = async (url, init) => {
      seen = { url, init: init! }
      return jsonRes(200, { id: 'abc-123' })
    }
    const r = await resendProvider('re_chave', f).send({ to: 'ana@ex.com', from: 'Eu <eu@meudominio.com>', replyTo: 'eu@meudominio.com', subject: 'Oi', text: 'Olá', headers: { 'List-Unsubscribe': '<https://x>' } })
    expect(r).toEqual({ ok: true, id: 'abc-123' })
    expect(seen!.url).toBe('https://api.resend.com/emails')
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer re_chave')
    const body = JSON.parse(seen!.init.body as string)
    expect(body).toMatchObject({ from: 'Eu <eu@meudominio.com>', to: ['ana@ex.com'], reply_to: 'eu@meudominio.com', subject: 'Oi', text: 'Olá' })
    expect(body.html).toBeUndefined() // texto simples, sem HTML nem rastreamento
  })

  it('Resend: 429 e 5xx valem nova tentativa; 422 não; falha de rede também tenta de novo', async () => {
    const m = { to: 'a@b.com', from: 'x@y.com', subject: 's', text: 't' }
    expect(await resendProvider('k', async () => jsonRes(429, { message: 'limite' })).send(m)).toMatchObject({ ok: false, retry: true })
    expect(await resendProvider('k', async () => jsonRes(503, {})).send(m)).toMatchObject({ ok: false, retry: true })
    expect(await resendProvider('k', async () => jsonRes(422, { message: 'domínio não verificado' })).send(m)).toMatchObject({ ok: false, retry: false })
    expect(await resendProvider('k', async () => { throw new Error('timeout') }).send(m)).toMatchObject({ ok: false, retry: true })
  })

  it('Evolution: envia pelo número só com dígitos, usa a chave no cabeçalho e verifica o número', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const f: FetchLike = async (url, init) => {
      calls.push({ url, init: init! })
      return url.includes('whatsappNumbers') ? jsonRes(200, [{ exists: true, jid: '5511912345678@s.whatsapp.net' }]) : jsonRes(201, { key: { id: 'WA-1' } })
    }
    const p = evolutionProvider({ baseUrl: 'https://evo.exemplo.com/', instance: 'empresa', apiKey: 'chave' }, f)
    expect(await p.checkNumber('+55 (11) 91234-5678')).toBe(true)
    expect(await p.send('+5511912345678', 'Oi!')).toEqual({ ok: true, id: 'WA-1' })
    expect(calls[0].url).toBe('https://evo.exemplo.com/chat/whatsappNumbers/empresa')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ numbers: ['5511912345678'] })
    expect(calls[1].url).toBe('https://evo.exemplo.com/message/sendText/empresa')
    expect((calls[1].init.headers as Record<string, string>).apikey).toBe('chave')
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ number: '5511912345678', text: 'Oi!' })
  })

  it('Evolution: número sem WhatsApp, erro 4xx sem nova tentativa e verificação indisponível vira "não sei"', async () => {
    const cfg = { baseUrl: 'https://evo', instance: 'i', apiKey: 'k' }
    expect(await evolutionProvider(cfg, async () => jsonRes(200, [{ exists: false }])).checkNumber('+5511999999999')).toBe(false)
    expect(await evolutionProvider(cfg, async () => jsonRes(500, {})).checkNumber('+5511999999999')).toBeNull()
    expect(await evolutionProvider(cfg, async () => jsonRes(400, { error: 'bad' })).send('+5511999999999', 'x')).toMatchObject({ ok: false, retry: false })
  })
})

describe('descadastro assinado', () => {
  it('o token válido volta com a organização e o lead; adulterado ou de outro segredo não', async () => {
    const t = await signUnsubscribe('segredo', ORG, LEAD)
    expect(await verifyUnsubscribe('segredo', t)).toEqual({ orgId: ORG, leadId: LEAD })
    expect(await verifyUnsubscribe('outro-segredo', t)).toBeNull()
    expect(await verifyUnsubscribe('segredo', t.slice(0, -2) + 'AA')).toBeNull()
    const other = await signUnsubscribe('segredo', ORG, '33333333-3333-4333-8333-333333333333')
    expect(await verifyUnsubscribe('segredo', `${t.split('.')[0]}.${other.split('.')[1]}`)).toBeNull() // troca de lead com a assinatura de outro
    expect(await verifyUnsubscribe('segredo', 'lixo')).toBeNull()
    expect(await verifyUnsubscribe('segredo', '')).toBeNull()
  })

  it('o handler descadastra com token válido (GET ou POST) e recusa o inválido', async () => {
    const calls: string[] = []
    const db = { unsubscribe: async (o: string, l: string) => void calls.push(`${o}/${l}`) }
    const t = await signUnsubscribe('s', ORG, LEAD)
    expect((await handleUnsubscribe(new Request(`https://x/unsubscribe?t=${t}`), { db, secret: 's' })).status).toBe(200)
    expect((await handleUnsubscribe(new Request(`https://x/unsubscribe?t=${t}`, { method: 'POST' }), { db, secret: 's' })).status).toBe(200)
    expect(calls).toEqual([`${ORG}/${LEAD}`, `${ORG}/${LEAD}`])
    expect((await handleUnsubscribe(new Request('https://x/unsubscribe?t=ruim'), { db, secret: 's' })).status).toBe(400)
    expect((await handleUnsubscribe(new Request(`https://x/unsubscribe?t=${t}`, { method: 'DELETE' }), { db, secret: 's' })).status).toBe(405)
    expect(calls).toHaveLength(2)
  })
})

describe('eventos dos webhooks', () => {
  it('Resend: bounce e reclamação viram supressão; outros eventos são ignorados', () => {
    expect(parseResendEvent({ type: 'email.bounced', data: { to: ['Ana@Ex.com'] } })).toEqual([{ kind: 'bounce', email: 'ana@ex.com' }])
    expect(parseResendEvent({ type: 'email.complained', data: { to: 'bia@ex.com' } })).toEqual([{ kind: 'complaint', email: 'bia@ex.com' }])
    expect(parseResendEvent({ type: 'email.delivered', data: { to: ['x@y.com'] } })).toEqual([])
    expect(parseResendEvent(null)).toEqual([])
  })

  const upsert = (extra: Record<string, unknown> = {}, key: Record<string, unknown> = {}) => ({
    event: 'messages.upsert',
    data: { key: { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: 'M1', ...key }, message: { conversation: ' Tenho interesse ' }, messageTimestamp: 1_760_000_000, ...extra },
  })

  it('Evolution: mensagem recebida vira resposta com telefone E.164', () => {
    expect(parseEvolutionEvent(upsert())).toEqual({ kind: 'message', phone: '+5511912345678', text: 'Tenho interesse', id: 'M1', at: new Date(1_760_000_000 * 1000).toISOString() })
    expect(parseEvolutionEvent({ event: 'MESSAGES_UPSERT', data: upsert().data })).toMatchObject({ kind: 'message' })
    expect(parseEvolutionEvent(upsert({ message: { extendedTextMessage: { text: 'Pode ligar' } } }))).toMatchObject({ text: 'Pode ligar' })
  })

  it('Evolution: ignora o que enviamos, grupos, mensagens sem texto e eventos desconhecidos', () => {
    expect(parseEvolutionEvent(upsert({}, { fromMe: true }))).toBeNull()
    expect(parseEvolutionEvent(upsert({}, { remoteJid: '1203630@g.us' }))).toBeNull()
    expect(parseEvolutionEvent(upsert({ message: {} }))).toBeNull()
    expect(parseEvolutionEvent({ event: 'presence.update', data: {} })).toBeNull()
  })

  it('Evolution: estado da conexão', () => {
    expect(parseEvolutionEvent({ event: 'connection.update', data: { state: 'open' } })).toEqual({ kind: 'connection', state: 'open' })
    expect(parseEvolutionEvent({ event: 'CONNECTION_UPDATE', data: { state: 'close' } })).toEqual({ kind: 'connection', state: 'close' })
    expect(parseEvolutionEvent({ event: 'connection.update', data: { state: 'qualquer' } })).toBeNull()
  })
})

async function svixHeaders(secretB64: string, id: string, ts: number, body: string) {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)))
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${btoa(String.fromCharCode(...sig))}` }
}

describe('webhooks (handlers)', () => {
  const secretB64 = btoa('uma-chave-de-teste-32-bytes-ok!!!!')
  const NOW = 1_760_000_000
  const memoryDb = () => {
    const log: string[] = []
    const db: WebhookDb = {
      orgsForEmail: async (e) => (e === 'ana@ex.com' ? [ORG] : []),
      orgsForPhone: async (p) => (p === '+5511912345678' ? [ORG] : []),
      suppress: async (o, c, v, r) => void log.push(`suppress ${o} ${c} ${v} ${r}`),
      insertInbound: async (o, m) => void log.push(`inbound ${o} ${m.from} ${m.body}`),
      setWhatsappState: async (s) => void log.push(`state ${s}`),
    }
    return { db, log }
  }

  it('Svix: assinatura certa passa; corpo, segredo ou data fora do prazo falham', async () => {
    const body = '{"type":"email.bounced"}'
    const h = await svixHeaders(secretB64, 'msg_1', NOW, body)
    const base = { secret: `whsec_${secretB64}`, id: h['svix-id'], timestamp: h['svix-timestamp'], signature: h['svix-signature'], body, nowS: NOW }
    expect(await verifySvix(base)).toBe(true)
    expect(await verifySvix({ ...base, body: body + ' ' })).toBe(false)
    expect(await verifySvix({ ...base, secret: `whsec_${btoa('outra-chave-diferente-32-bytes!!!!!')}` })).toBe(false)
    expect(await verifySvix({ ...base, nowS: NOW + 3600 })).toBe(false)
    expect(await verifySvix({ ...base, signature: null })).toBe(false)
  })

  it('Resend: bounce assinado suprime o e-mail; sem assinatura, 401 e nada muda', async () => {
    const { db, log } = memoryDb()
    const body = JSON.stringify({ type: 'email.bounced', data: { to: ['ana@ex.com'] } })
    const ok = await handleResendWebhook(new Request('https://x/resend', { method: 'POST', body, headers: await svixHeaders(secretB64, 'm1', NOW, body) }), { db, secret: `whsec_${secretB64}`, nowS: NOW })
    expect(ok.status).toBe(200)
    expect(log).toEqual([`suppress ${ORG} email ana@ex.com bounce`])
    const bad = await handleResendWebhook(new Request('https://x/resend', { method: 'POST', body }), { db, secret: `whsec_${secretB64}`, nowS: NOW })
    expect(bad.status).toBe(401)
    expect(log).toHaveLength(1)
  })

  it('Evolution: segredo errado 401; resposta casada grava; conexão atualiza; telefone desconhecido não grava', async () => {
    const { db, log } = memoryDb()
    const send = (payload: unknown, secret: string | null) =>
      handleEvolutionWebhook(new Request('https://x/evo', { method: 'POST', body: JSON.stringify(payload), headers: secret ? { 'x-webhook-secret': secret } : {} }), { db, secret: 's3gredo' })
    const msg = { event: 'messages.upsert', data: { key: { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: 'M1' }, message: { conversation: 'SAIR' }, messageTimestamp: 1_760_000_000 } }
    expect((await send(msg, 'errado')).status).toBe(401)
    expect((await send(msg, null)).status).toBe(401)
    expect((await send(msg, 's3gredo')).status).toBe(200)
    expect(log).toEqual([`inbound ${ORG} +5511912345678 SAIR`])
    expect((await send({ event: 'connection.update', data: { state: 'open' } }, 's3gredo')).status).toBe(200)
    const unknown = { event: 'messages.upsert', data: { key: { remoteJid: '5511000000000@s.whatsapp.net', fromMe: false, id: 'M2' }, message: { conversation: 'oi' } } }
    await send(unknown, 's3gredo')
    expect(log).toEqual([`inbound ${ORG} +5511912345678 SAIR`, 'state open'])
  })
})

describe('send-outbox (lote de envio)', () => {
  const claimed = (o: Partial<Claimed> & { id: string; channel: 'email' | 'whatsapp' }): Claimed => ({
    organization_id: ORG, lead_id: LEAD, to_address: o.channel === 'email' ? 'ana@ex.com' : '+5511912345678', subject: o.channel === 'email' ? 'Oi' : null, body: 'Olá', attempts: 1, ...o,
  })
  const setup = (rows: Claimed[], sender: { email_from: string | null; email_reply_to: string | null } | null = { email_from: 'Eu <eu@meudominio.com>', email_reply_to: null }) => {
    const finished: { id: string; ok: boolean; error: string | null; retry: boolean; messageId: string | null }[] = []
    const db: OutboxDb = {
      claim: async (channel) => rows.filter((r) => r.channel === channel),
      finish: async (i) => void finished.push({ id: i.id, ok: i.ok, error: i.error, retry: i.retry, messageId: i.messageId }),
      sender: async () => sender,
    }
    return { db, finished }
  }
  const req = (secret: string | null, method = 'POST') => new Request('https://x/send', { method, headers: secret ? { 'x-cron-secret': secret } : {} })
  const base = { cronSecret: 'cron', unsubscribeSecret: 'unsub', unsubscribeBaseUrl: 'https://proj.supabase.co/functions/v1/unsubscribe' }

  it('só o agendador (segredo certo, POST) dispara o envio', async () => {
    const { db } = setup([])
    const email = fakeEmailProvider()
    const whatsapp = fakeWhatsAppProvider()
    expect((await handleSendOutbox(req(null), { ...base, db, email, whatsapp })).status).toBe(401)
    expect((await handleSendOutbox(req('errado'), { ...base, db, email, whatsapp })).status).toBe(401)
    expect((await handleSendOutbox(req('cron', 'GET'), { ...base, db, email, whatsapp })).status).toBe(405)
    expect((await handleSendOutbox(req('cron'), { ...base, db, email, whatsapp })).status).toBe(200)
  })

  it('e-mail: texto simples com rodapé de saída e cabeçalhos List-Unsubscribe; WhatsApp com "SAIR"', async () => {
    const { db, finished } = setup([claimed({ id: 'e1', channel: 'email' }), claimed({ id: 'w1', channel: 'whatsapp' })])
    const email = fakeEmailProvider()
    const whatsapp = fakeWhatsAppProvider()
    const res = await handleSendOutbox(req('cron'), { ...base, db, email, whatsapp })
    expect(await res.json()).toEqual({ sent: 2, failed: 0, retried: 0, skipped: 0 })
    expect(finished.map((f) => [f.id, f.ok])).toEqual([['e1', true], ['w1', true]])
    const sent = email.sent[0]
    expect(sent.from).toBe('Eu <eu@meudominio.com>')
    expect(sent.text).toContain('Olá')
    expect(sent.text).toContain('Para não receber mais mensagens, acesse: https://proj.supabase.co/functions/v1/unsubscribe?t=')
    expect(sent.headers!['List-Unsubscribe']).toMatch(/^<https:\/\/proj\.supabase\.co\/functions\/v1\/unsubscribe\?t=.+>$/)
    expect(sent.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(whatsapp.sent[0].text).toMatch(/Olá\n\nResponda SAIR/)
    // o link do rodapé é o do lead certo
    const token = new URL(sent.headers!['List-Unsubscribe'].slice(1, -1)).searchParams.get('t')!
    expect(await verifyUnsubscribe('unsub', token)).toEqual({ orgId: ORG, leadId: LEAD })
  })

  it('sem remetente configurado a mensagem falha sem nova tentativa e nada é enviado', async () => {
    const { db, finished } = setup([claimed({ id: 'e1', channel: 'email' })], { email_from: null, email_reply_to: null })
    const email = fakeEmailProvider()
    const res = await handleSendOutbox(req('cron'), { ...base, db, email, whatsapp: fakeWhatsAppProvider() })
    expect(await res.json()).toMatchObject({ sent: 0, failed: 1 })
    expect(email.sent).toHaveLength(0)
    expect(finished[0]).toMatchObject({ ok: false, retry: false })
    expect(finished[0].error).toContain('remetente')
  })

  it('falha temporária pede nova tentativa; na 3ª vira falha; número sem WhatsApp não envia', async () => {
    const { db, finished } = setup([claimed({ id: 'e1', channel: 'email', attempts: 1 }), claimed({ id: 'e2', channel: 'email', attempts: 3 }), claimed({ id: 'w1', channel: 'whatsapp' })])
    const email = fakeEmailProvider([], { error: 'HTTP 503', retry: true })
    const whatsapp = fakeWhatsAppProvider([], { hasWhatsApp: () => false })
    const res = await handleSendOutbox(req('cron'), { ...base, db, email, whatsapp })
    expect(await res.json()).toEqual({ sent: 0, failed: 2, retried: 1, skipped: 0 })
    expect(finished.find((f) => f.id === 'e1')).toMatchObject({ ok: false, retry: true })
    expect(finished.find((f) => f.id === 'w1')).toMatchObject({ ok: false, retry: false })
    expect(whatsapp.sent).toHaveLength(0)
  })
})
