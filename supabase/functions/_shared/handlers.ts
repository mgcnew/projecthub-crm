/**
 * Lógica HTTP das Edge Functions (D143–D146), separada do runtime: cada handler recebe um `Request` e as
 * dependências (banco, provedores, segredos) e devolve um `Response`. Os `index.ts` só ligam o ambiente.
 * Assim a lógica é testada com Request/Response e `fetch` simulado, sem Deno nem serviço real.
 */
import { parseEvolutionEvent, parseResendEvent } from './events.ts'
import type { EmailProvider, WhatsAppProvider } from './providers.ts'
import { verifySvix } from './svix.ts'
import { emailFooter, safeEqual, signUnsubscribe, verifyUnsubscribe, whatsappFooter } from './unsubscribe.ts'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const enc = new TextEncoder()
const sameSecret = (a: string | null, b: string) => a !== null && safeEqual(enc.encode(a), enc.encode(b))

// ------------------------------------------------------------------ envio
export type Claimed = {
  id: string
  organization_id: string
  lead_id: string
  channel: string
  to_address: string
  subject: string | null
  body: string
  attempts: number
}

export interface OutboxDb {
  claim(channel: 'email' | 'whatsapp', max: number): Promise<Claimed[]>
  finish(input: { id: string; ok: boolean; provider: string; messageId: string | null; error: string | null; retry: boolean }): Promise<void>
  sender(orgId: string): Promise<{ email_from: string | null; email_reply_to: string | null } | null>
}

export type SendDeps = {
  db: OutboxDb
  email: EmailProvider
  whatsapp: WhatsAppProvider
  cronSecret: string
  unsubscribeSecret: string
  /** Endereço público da função `unsubscribe`. */
  unsubscribeBaseUrl: string
}

export type SendSummary = { sent: number; failed: number; retried: number; skipped: number }

/** Chamado pelo pg_cron a cada minuto (cabeçalho `x-cron-secret`): envia o que o banco liberou. */
export async function handleSendOutbox(req: Request, deps: SendDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'método não permitido' })
  if (!sameSecret(req.headers.get('x-cron-secret'), deps.cronSecret)) return json(401, { error: 'não autorizado' })

  const summary: SendSummary = { sent: 0, failed: 0, retried: 0, skipped: 0 }
  const settle = async (m: Claimed, provider: string, r: { ok: true; id: string } | { ok: false; error: string; retry: boolean }) => {
    await deps.db.finish({ id: m.id, ok: r.ok, provider, messageId: r.ok ? r.id : null, error: r.ok ? null : r.error, retry: r.ok ? false : r.retry })
    if (r.ok) summary.sent++
    else if (r.retry && m.attempts < 3) summary.retried++
    else summary.failed++
  }

  for (const m of await deps.db.claim('email', 20)) {
    const sender = await deps.db.sender(m.organization_id)
    if (!sender?.email_from) {
      await settle(m, deps.email.name, { ok: false, error: 'remetente (e-mail de envio) não configurado', retry: false })
      continue
    }
    const url = `${deps.unsubscribeBaseUrl}?t=${await signUnsubscribe(deps.unsubscribeSecret, m.organization_id, m.lead_id)}`
    const result = await deps.email.send({
      to: m.to_address,
      from: sender.email_from,
      replyTo: sender.email_reply_to,
      subject: m.subject ?? '',
      text: m.body + emailFooter(url),
      headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    await settle(m, deps.email.name, result)
  }

  // WhatsApp: o banco devolve no máximo 1 por rodada, já respeitando o intervalo aleatório e a conexão aberta.
  for (const m of await deps.db.claim('whatsapp', 1)) {
    const has = await deps.whatsapp.checkNumber(m.to_address)
    if (has === false) {
      await settle(m, deps.whatsapp.name, { ok: false, error: 'o número não tem WhatsApp', retry: false })
      continue
    }
    await settle(m, deps.whatsapp.name, await deps.whatsapp.send(m.to_address, m.body + whatsappFooter))
  }
  return json(200, summary)
}

// ------------------------------------------------------------- descadastro
export interface UnsubscribeDb {
  unsubscribe(orgId: string, leadId: string): Promise<void>
}

const page = (status: number, title: string, text: string) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${text}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

/** Link do e-mail (GET) e botão "cancelar inscrição" do provedor de e-mail (POST). Token assinado. */
export async function handleUnsubscribe(req: Request, deps: { db: UnsubscribeDb; secret: string }): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return json(405, { error: 'método não permitido' })
  const token = new URL(req.url).searchParams.get('t') ?? ''
  const who = await verifyUnsubscribe(deps.secret, token)
  if (!who) return page(400, 'Link inválido', 'Este link de descadastro não é válido ou foi alterado.')
  await deps.db.unsubscribe(who.orgId, who.leadId)
  return page(200, 'Pronto', 'Você não receberá mais mensagens nossas.')
}

// ------------------------------------------------------------ webhooks
export interface WebhookDb {
  orgsForEmail(email: string): Promise<string[]>
  orgsForPhone(phone: string): Promise<string[]>
  suppress(orgId: string, channel: 'email' | 'whatsapp' | 'all', value: string, reason: 'bounce' | 'complaint'): Promise<void>
  insertInbound(orgId: string, msg: { channel: 'whatsapp'; from: string; body: string; at: string; providerId: string }): Promise<void>
  setWhatsappState(state: 'open' | 'connecting' | 'close'): Promise<void>
}

/** Webhook do Resend: assinatura Svix; bounce e reclamação suprimem o endereço (e cancelam as pendentes). */
export async function handleResendWebhook(req: Request, deps: { db: WebhookDb; secret: string; nowS?: number }): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'método não permitido' })
  const body = await req.text()
  const ok = await verifySvix({
    secret: deps.secret,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    body,
    nowS: deps.nowS,
  })
  if (!ok) return json(401, { error: 'assinatura inválida' })
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return json(400, { error: 'JSON inválido' })
  }
  let suppressed = 0
  for (const ev of parseResendEvent(payload)) {
    if (!ev) continue
    for (const org of await deps.db.orgsForEmail(ev.email)) {
      await deps.db.suppress(org, 'email', ev.email, ev.kind === 'bounce' ? 'bounce' : 'complaint')
      suppressed++
    }
  }
  return json(200, { suppressed })
}

/** Webhook do Evolution (segredo no cabeçalho `x-webhook-secret` ou em `?secret=`): respostas e estado da conexão. */
export async function handleEvolutionWebhook(req: Request, deps: { db: WebhookDb; secret: string }): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'método não permitido' })
  const given = req.headers.get('x-webhook-secret') ?? new URL(req.url).searchParams.get('secret')
  if (!sameSecret(given, deps.secret)) return json(401, { error: 'não autorizado' })
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'JSON inválido' })
  }
  const ev = parseEvolutionEvent(payload)
  if (!ev) return json(200, { ignored: true })
  if (ev.kind === 'connection') {
    await deps.db.setWhatsappState(ev.state)
    return json(200, { state: ev.state })
  }
  let stored = 0
  for (const org of await deps.db.orgsForPhone(ev.phone)) {
    await deps.db.insertInbound(org, { channel: 'whatsapp', from: ev.phone, body: ev.text, at: ev.at, providerId: ev.id })
    stored++
  }
  return json(200, { stored })
}
