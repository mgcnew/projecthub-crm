/**
 * Rascunho com IA (D149): `DraftProvider` (`none` | `deepseek`), guia de estilo, limite de uso por dia. Preparado e DESLIGADO:
 * só funciona com `draft_provider = 'deepseek'` na configuração E a chave no servidor. O resultado é um RASCUNHO normal da fila
 * (marcado `generated_by = 'ai'`), que passa pelo mesmo verificador de estilo e pela mesma aprovação humana.
 * Privacidade: ao provedor vão só empresa, primeiro nome do contato, gancho, segmento, cidade e o sistema; nunca e-mail nem telefone.
 */
import type { FetchLike } from './providers.ts'

export const STYLE_GUIDE = `Você escreve a primeira mensagem de prospecção de um desenvolvedor freelancer brasileiro que vende sistemas para pequenas empresas.
Regras:
- Soe como uma pessoa escrevendo de verdade, em português do Brasil, tom direto e educado. Nada de texto de propaganda.
- Curto: no máximo {{max}} caracteres. Uma ideia só.
- Comece pelo que você notou na empresa (use o gancho, se houver) e só depois fale do sistema, numa frase.
- Termine com UMA pergunta simples. Nunca mais de uma pergunta.
- Sem link, sem emoji, sem exclamação em excesso, sem lista, sem negrito.
- Nunca use frases prontas como "espero que esteja bem", "venho por meio desta", "solução inovadora", "alavancar", "sinergia" ou "transformação digital".
- Não invente fatos, números, clientes nem resultados. Se faltar o gancho, seja honesto e genérico, sem fingir que viu algo.
- Não prometa prazo nem preço.
Responda APENAS com JSON: {"subject": "...", "body": "..."}. Sem "subject" no WhatsApp.`

export type DraftContext = {
  channel: 'email' | 'whatsapp'
  step: number
  lead: { company_name: string; contact_first_name: string | null; hook: string | null; segment: string | null; city: string | null }
  product: { name: string; value_proposition: string | null } | null
  /** Texto de um modelo de referência (tom e estrutura desejados). */
  reference: { subject: string | null; body: string } | null
}

export type DraftResult = { ok: true; subject: string | null; body: string } | { ok: false; error: string; retry: boolean }

export interface DraftProvider {
  readonly name: string
  generate(ctx: DraftContext): Promise<DraftResult>
}

export const maxChars = (channel: 'email' | 'whatsapp', step: number) => (channel === 'email' ? (step === 1 ? 600 : 400) : step === 1 ? 300 : 200)

/** Monta as mensagens do chat (puro, testável). */
export function buildMessages(ctx: DraftContext): { role: 'system' | 'user'; content: string }[] {
  const lines = [
    `Canal: ${ctx.channel === 'email' ? 'e-mail' : 'WhatsApp'} (passo ${ctx.step} da sequência).`,
    `Empresa: ${ctx.lead.company_name}`,
    ctx.lead.contact_first_name ? `Contato (primeiro nome): ${ctx.lead.contact_first_name}` : 'Contato: não informado (não invente um nome).',
    ctx.lead.hook ? `Gancho (o que notamos nesta empresa): ${ctx.lead.hook}` : 'Gancho: não informado.',
    ctx.lead.segment ? `Segmento: ${ctx.lead.segment}` : null,
    ctx.lead.city ? `Cidade: ${ctx.lead.city}` : null,
    ctx.product ? `Sistema: ${ctx.product.name}${ctx.product.value_proposition ? ` — ${ctx.product.value_proposition}` : ''}` : 'Sistema: não informado.',
    ctx.reference ? `Modelo de referência (imite o tom e o tamanho, não copie):\n${ctx.reference.subject ? `Assunto: ${ctx.reference.subject}\n` : ''}${ctx.reference.body}` : null,
  ].filter(Boolean)
  return [
    { role: 'system', content: STYLE_GUIDE.replace('{{max}}', String(maxChars(ctx.channel, ctx.step))) },
    { role: 'user', content: lines.join('\n') },
  ]
}

/** Extrai o JSON da resposta (aceita texto em volta ou cerca de código) e limpa o resultado. */
export function parseDraft(raw: string, channel: 'email' | 'whatsapp'): { subject: string | null; body: string } | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as { subject?: unknown; body?: unknown }
    const body = typeof o.body === 'string' ? o.body.trim() : ''
    if (!body || body.length > 4000) return null
    const subject = typeof o.subject === 'string' ? o.subject.trim().slice(0, 200) : ''
    if (channel === 'email') return subject ? { subject, body } : null
    return { subject: null, body }
  } catch {
    return null
  }
}

export function deepseekProvider(apiKey: string, fetchImpl: FetchLike = fetch, model = 'deepseek-chat'): DraftProvider {
  return {
    name: 'deepseek',
    async generate(ctx) {
      try {
        const res = await fetchImpl('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: buildMessages(ctx), temperature: 0.7, max_tokens: 500, response_format: { type: 'json_object' } }),
        })
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, retry: res.status === 429 || res.status >= 500 }
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
        const parsed = parseDraft(json.choices?.[0]?.message?.content ?? '', ctx.channel)
        if (!parsed) return { ok: false, error: 'a IA não devolveu um rascunho válido', retry: true }
        return { ok: true, ...parsed }
      } catch (e) {
        return { ok: false, error: `falha de rede: ${(e as Error).message}`, retry: true }
      }
    },
  }
}

/** Provedor desligado (padrão): nunca gera nada. */
export const noneProvider: DraftProvider = {
  name: 'none',
  async generate() {
    return { ok: false, error: 'a IA está desligada', retry: false }
  },
}

/** Provedor de mentira para testes e desenvolvimento. */
export function fakeDraftProvider(result?: DraftResult): DraftProvider & { calls: DraftContext[] } {
  const calls: DraftContext[] = []
  return {
    name: 'fake',
    calls,
    async generate(ctx) {
      calls.push(ctx)
      return result ?? { ok: true, subject: ctx.channel === 'email' ? `Uma ideia para a ${ctx.lead.company_name}` : null, body: `Oi! Vi a ${ctx.lead.company_name}. Posso te mostrar um exemplo?` }
    },
  }
}

// ----------------------------------------------------------------- handler
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export type DraftRequestContext = {
  organization_id: string
  channel: 'email' | 'whatsapp'
  step: number
  template_id: string
  lead: DraftContext['lead']
  product: DraftContext['product']
  reference: DraftContext['reference']
}

export interface DraftDb {
  /** Como o usuário (RLS + MFA): configuração da organização dele. */
  settings(): Promise<{ organization_id: string; draft_provider: string; ai_daily_limit: number } | null>
  /** Quantos rascunhos de IA a organização já gerou desde `sinceISO`. */
  aiCount(orgId: string, sinceISO: string): Promise<number>
  /** Como o usuário: lead, modelo e sistema (a RLS garante que são da organização dele). */
  context(leadId: string, templateId: string): Promise<DraftRequestContext | null>
  /** Como servidor: cria o rascunho (`generated_by = 'ai'`); o banco confere elegibilidade e supressão. */
  insertDraft(input: { orgId: string; leadId: string; templateId: string; channel: 'email' | 'whatsapp'; subject: string | null; body: string }): Promise<{ id: string } | { error: string }>
}

/** POST { leadId, templateId } com o JWT do usuário (`verify_jwt = true`). Devolve o id do rascunho criado. */
export async function handleDraftMessage(req: Request, deps: { db: DraftDb; provider: DraftProvider; now?: () => Date }): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'método não permitido' })
  let body: { leadId?: unknown; templateId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'JSON inválido' })
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (typeof body.leadId !== 'string' || typeof body.templateId !== 'string' || !uuid.test(body.leadId) || !uuid.test(body.templateId)) {
    return json(400, { error: 'informe leadId e templateId' })
  }
  const settings = await deps.db.settings()
  if (!settings) return json(403, { error: 'sem acesso à configuração da prospecção' })
  if (settings.draft_provider !== 'deepseek') return json(409, { error: 'A IA está desligada nas configurações.' })

  const now = (deps.now ?? (() => new Date()))()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  if ((await deps.db.aiCount(settings.organization_id, dayStart)) >= settings.ai_daily_limit) {
    return json(429, { error: `Limite diário de ${settings.ai_daily_limit} rascunhos de IA atingido.` })
  }
  const ctx = await deps.db.context(body.leadId, body.templateId)
  if (!ctx || ctx.organization_id !== settings.organization_id) return json(404, { error: 'lead ou modelo não encontrado' })

  const result = await deps.provider.generate({ channel: ctx.channel, step: ctx.step, lead: ctx.lead, product: ctx.product, reference: ctx.reference })
  if (!result.ok) return json(result.retry ? 502 : 409, { error: result.error })
  const created = await deps.db.insertDraft({
    orgId: ctx.organization_id,
    leadId: body.leadId,
    templateId: body.templateId,
    channel: ctx.channel,
    subject: result.subject,
    body: result.body,
  })
  if ('error' in created) return json(422, { error: created.error })
  return json(200, { id: created.id })
}
