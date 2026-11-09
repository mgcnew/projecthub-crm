/**
 * Adaptadores de banco das Edge Functions (service_role). Só chamam as funções `public.outbox_*` e leem o mínimo
 * necessário; a regra de negócio fica no banco. O cliente vem do `index.ts` (import `npm:` do Deno).
 */
import type { OutboxDb, UnsubscribeDb, WebhookDb } from './handlers.ts'

// Tipagem mínima do supabase-js (o pacote só existe no runtime do Deno).
type Rpc = { error: { message: string } | null; data: unknown }
type Query = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select(cols: string): Query
  eq(col: string, v: unknown): Query
  ilike(col: string, v: string): Query
  limit(n: number): Query
  maybeSingle(): Query
}
export interface ServiceClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Rpc>
  from(table: string): { select(cols: string): Query; insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string; code?: string } | null }> }
}

const must = (r: { error: { message: string } | null }, what: string) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
}

export function outboxDb(c: ServiceClient): OutboxDb {
  return {
    async claim(channel, max) {
      const r = await c.rpc('outbox_claim', { p_channel: channel, p_max: max })
      must(r, 'outbox_claim')
      return (r.data as ReturnType<OutboxDb['claim']> extends Promise<infer T> ? T : never) ?? []
    },
    async finish(i) {
      const r = await c.rpc('outbox_finish', { p_id: i.id, p_ok: i.ok, p_provider: i.provider, p_message_id: i.messageId, p_error: i.error, p_retry: i.retry })
      must(r, 'outbox_finish')
    },
    async sender(orgId) {
      const r = await c.from('outreach_settings').select('email_from, email_reply_to').eq('organization_id', orgId).maybeSingle()
      const res = await r
      must(res, 'outreach_settings')
      return (res.data as { email_from: string | null; email_reply_to: string | null } | null) ?? null
    },
  }
}

export function unsubscribeDb(c: ServiceClient): UnsubscribeDb {
  return {
    async unsubscribe(orgId, leadId) {
      must(await c.rpc('outbox_unsubscribe', { p_org: orgId, p_lead: leadId }), 'outbox_unsubscribe')
    },
  }
}

export function webhookDb(c: ServiceClient): WebhookDb {
  const orgs = async (col: 'email' | 'phone', value: string) => {
    const res = await c.from('leads').select('organization_id').ilike(col, value).limit(20)
    must(res, 'leads')
    return [...new Set(((res.data as { organization_id: string }[] | null) ?? []).map((r) => r.organization_id))]
  }
  return {
    orgsForEmail: (email) => orgs('email', email),
    orgsForPhone: (phone) => orgs('phone', phone),
    async suppress(orgId, channel, value, reason) {
      must(await c.rpc('outbox_suppress', { p_org: orgId, p_channel: channel, p_value: value, p_reason: reason }), 'outbox_suppress')
    },
    async insertInbound(orgId, m) {
      const r = await c.from('inbound_messages').insert({
        organization_id: orgId,
        channel: m.channel,
        from_address: m.from,
        body: m.body,
        received_at: m.at,
        provider_message_id: m.providerId,
      })
      // Mensagem repetida pelo provedor (mesmo id): ignora em vez de falhar o webhook.
      if (r.error && r.error.code !== '23505') throw new Error(`inbound_messages: ${r.error.message}`)
    },
    async setWhatsappState(state) {
      const res = await c.from('outreach_settings').select('organization_id').limit(50)
      must(res, 'outreach_settings')
      for (const row of (res.data as { organization_id: string }[] | null) ?? []) {
        must(await c.rpc('outbox_whatsapp_state', { p_org: row.organization_id, p_state: state }), 'outbox_whatsapp_state')
      }
    },
  }
}

// ---------------------------------------------------------------- rascunho com IA
import type { DraftDb, DraftRequestContext } from './draft.ts'

type UserQuery = PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }> & {
  select(cols: string, opts?: { count: 'exact'; head: boolean }): UserQuery
  eq(col: string, v: unknown): UserQuery
  gte(col: string, v: string): UserQuery
  maybeSingle(): UserQuery
}
export interface UserClient {
  from(table: string): { select(cols: string, opts?: { count: 'exact'; head: boolean }): UserQuery }
}

/** `user` = cliente com o JWT do usuário (RLS + MFA); `service` = service_role, só para gravar o rascunho. */
export function draftDb(user: UserClient, service: ServiceClient): DraftDb {
  return {
    async settings() {
      const r = await user.from('outreach_settings').select('organization_id, draft_provider, ai_daily_limit').maybeSingle()
      return (r.data as { organization_id: string; draft_provider: string; ai_daily_limit: number } | null) ?? null
    },
    async aiCount(orgId, sinceISO) {
      const r = await user.from('outbound_messages').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('generated_by', 'ai').gte('created_at', sinceISO)
      if (r.error) throw new Error(`outbound_messages: ${r.error.message}`)
      return r.count ?? 0
    },
    async context(leadId, templateId) {
      const l = await user.from('leads').select('organization_id, company_name, contact_name, hook, segment, city, product_id').eq('id', leadId).maybeSingle()
      const t = await user.from('message_templates').select('channel, step, subject, body, product_id').eq('id', templateId).maybeSingle()
      const lead = l.data as { organization_id: string; company_name: string; contact_name: string | null; hook: string | null; segment: string | null; city: string | null; product_id: string | null } | null
      const tpl = t.data as { channel: 'email' | 'whatsapp'; step: number; subject: string | null; body: string; product_id: string | null } | null
      if (!lead || !tpl) return null
      const productId = tpl.product_id ?? lead.product_id
      let product: DraftRequestContext['product'] = null
      if (productId) {
        const p = await user.from('products').select('name, value_proposition').eq('id', productId).maybeSingle()
        product = (p.data as DraftRequestContext['product']) ?? null
      }
      return {
        organization_id: lead.organization_id,
        channel: tpl.channel,
        step: tpl.step,
        template_id: templateId,
        lead: {
          company_name: lead.company_name,
          contact_first_name: lead.contact_name?.trim().split(/\s+/)[0] ?? null,
          hook: lead.hook,
          segment: lead.segment,
          city: lead.city,
        },
        product,
        reference: { subject: tpl.subject, body: tpl.body },
      }
    },
    async insertDraft(i) {
      const r = await service.from('outbound_messages').insert({
        organization_id: i.orgId,
        lead_id: i.leadId,
        template_id: i.templateId,
        channel: i.channel,
        subject: i.subject,
        body: i.body,
        generated_by: 'ai',
      })
      if (r.error) return { error: r.error.message }
      // O id volta por consulta (o insert do PostgREST sem `select` não devolve a linha).
      const q = await service.from('outbound_messages').select('id').eq('lead_id', i.leadId).eq('template_id', i.templateId).eq('generated_by', 'ai').limit(1).maybeSingle()
      const row = (await q).data as { id: string } | null
      return row ? { id: row.id } : { error: 'rascunho criado, mas o id não voltou' }
    },
  }
}
