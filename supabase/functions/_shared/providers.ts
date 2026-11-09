/**
 * Provedores de envio atrás de interfaces (D143): `resend`/`evolution` em produção, `fake` em teste e
 * desenvolvimento (nenhum teste fala com serviço real). Só usa APIs padrão da web (fetch), sem Deno nem Node.
 */
export type SendResult = { ok: true; id: string } | { ok: false; error: string; retry: boolean }
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type EmailMessage = {
  to: string
  from: string
  replyTo?: string | null
  subject: string
  /** Texto simples: sem HTML, sem imagens, sem rastreamento de abertura. */
  text: string
  headers?: Record<string, string>
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<SendResult>
}

export interface WhatsAppProvider {
  readonly name: string
  /** `true` tem WhatsApp, `false` não tem, `null` não deu para saber (o envio segue e o provedor decide). */
  checkNumber(phoneE164: string): Promise<boolean | null>
  send(phoneE164: string, text: string): Promise<SendResult>
}

/** Falha de rede e erros 408/429/5xx valem nova tentativa; os demais 4xx não (dado errado não melhora sozinho). */
const retryable = (status: number) => status === 408 || status === 429 || status >= 500
const digits = (phone: string) => phone.replace(/\D/g, '')

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.text()).slice(0, 300)
    return `HTTP ${res.status}${body ? `: ${body}` : ''}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export function resendProvider(apiKey: string, fetchImpl: FetchLike = fetch): EmailProvider {
  return {
    name: 'resend',
    async send(m) {
      try {
        const res = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: m.from,
            to: [m.to],
            ...(m.replyTo ? { reply_to: m.replyTo } : {}),
            subject: m.subject,
            text: m.text,
            ...(m.headers ? { headers: m.headers } : {}),
          }),
        })
        if (!res.ok) return { ok: false, error: await errorText(res), retry: retryable(res.status) }
        const json = (await res.json()) as { id?: string }
        if (!json.id) return { ok: false, error: 'resposta do Resend sem id', retry: true }
        return { ok: true, id: json.id }
      } catch (e) {
        return { ok: false, error: `falha de rede: ${(e as Error).message}`, retry: true }
      }
    },
  }
}

export type EvolutionConfig = { baseUrl: string; instance: string; apiKey: string }

export function evolutionProvider(cfg: EvolutionConfig, fetchImpl: FetchLike = fetch): WhatsAppProvider {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const headers = { apikey: cfg.apiKey, 'Content-Type': 'application/json' }
  return {
    name: 'evolution',
    async checkNumber(phone) {
      try {
        const res = await fetchImpl(`${base}/chat/whatsappNumbers/${encodeURIComponent(cfg.instance)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ numbers: [digits(phone)] }),
        })
        if (!res.ok) return null
        const json = (await res.json()) as { exists?: boolean }[]
        return Array.isArray(json) && json.length > 0 ? json[0].exists === true : null
      } catch {
        return null
      }
    },
    async send(phone, text) {
      try {
        const res = await fetchImpl(`${base}/message/sendText/${encodeURIComponent(cfg.instance)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ number: digits(phone), text }),
        })
        if (!res.ok) return { ok: false, error: await errorText(res), retry: retryable(res.status) }
        const json = (await res.json()) as { key?: { id?: string } }
        const id = json.key?.id
        if (!id) return { ok: false, error: 'resposta do Evolution sem id', retry: true }
        return { ok: true, id }
      } catch (e) {
        return { ok: false, error: `falha de rede: ${(e as Error).message}`, retry: true }
      }
    },
  }
}

/** E-mail de mentira: guarda o que "enviou" e devolve sucesso (ou a falha programada). */
export function fakeEmailProvider(sink: EmailMessage[] = [], failWith?: { error: string; retry: boolean }): EmailProvider & { sent: EmailMessage[] } {
  return {
    name: 'fake',
    sent: sink,
    async send(m) {
      if (failWith) return { ok: false, ...failWith }
      sink.push(m)
      return { ok: true, id: `fake-email-${sink.length}` }
    },
  }
}

export function fakeWhatsAppProvider(
  sink: { to: string; text: string }[] = [],
  opts: { hasWhatsApp?: (phone: string) => boolean | null; failWith?: { error: string; retry: boolean } } = {},
): WhatsAppProvider & { sent: { to: string; text: string }[] } {
  return {
    name: 'fake',
    sent: sink,
    async checkNumber(phone) {
      return opts.hasWhatsApp ? opts.hasWhatsApp(phone) : true
    },
    async send(to, text) {
      if (opts.failWith) return { ok: false, ...opts.failWith }
      sink.push({ to, text })
      return { ok: true, id: `fake-wa-${sink.length}` }
    },
  }
}
