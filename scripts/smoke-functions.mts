// Teste de fumaça das Edge Functions de envio contra o Supabase local (precisa de `supabase functions serve` no ar
// com CRON_SECRET, UNSUBSCRIBE_SECRET e EVOLUTION_WEBHOOK_SECRET iguais aos abaixo). Usa provedores `fake`.
//   npx supabase functions serve --env-file <arquivo> &   node --experimental-strip-types scripts/smoke-functions.mts
import { createClient } from '@supabase/supabase-js'
import { signUnsubscribe } from '../supabase/functions/_shared/unsubscribe.ts'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!
const FN = `${url}/functions/v1`
const SECRETS = { cron: 'segredo-cron-teste', unsub: 'segredo-unsub-teste', evo: 'segredo-evo' }
const check = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FALHOU: ${msg}`)
  console.log(`ok - ${msg}`)
}

const c = createClient(url, key, { auth: { persistSession: false } })
const user = { email: `smoke-${Date.now()}@test.local`, password: `Pw-${Date.now()}-Aa1` }
await c.auth.signUp(user)
const { error: le } = await c.auth.signInWithPassword(user)
if (le) throw le
const org = (await c.from('organizations').select('id').single()).data!.id as string

await c.from('outreach_settings').insert({ organization_id: org, email_from: 'Eu <eu@meudominio.com>', window_start: '00:00', window_end: '23:59', weekdays_only: false })
const lead = (await c.from('leads').insert({ organization_id: org, company_name: 'Smoke Padaria', source: 'smoke', email: 'smoke@ex.com', phone: '+5511900000001', temperature: 'warm' }).select('id').single()).data!.id as string
const msg = (await c.from('outbound_messages').insert({ organization_id: org, lead_id: lead, channel: 'email', subject: 'Oi', body: 'Olá, tudo bem?' }).select('id').single()).data!.id as string
check((await c.from('outbound_messages').update({ status: 'approved' }).eq('id', msg)).error === null, 'mensagem aprovada')

const run = (secret: string | null) => fetch(`${FN}/send-outbox`, { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })
check((await run(null)).status === 401, 'send-outbox recusa sem segredo')
const res = await run(SECRETS.cron)
const summary = await res.json()
check(res.status === 200 && summary.sent === 1, `send-outbox enviou 1 (${JSON.stringify(summary)})`)
const sent = (await c.from('outbound_messages').select('status, provider, provider_message_id, sent_at').eq('id', msg).single()).data!
check(sent.status === 'sent' && sent.provider === 'fake' && sent.sent_at, 'mensagem ficou "enviada" pelo provedor fake')
check((await c.from('leads').select('stage').eq('id', lead).single()).data!.stage === 'contacted', 'lead novo virou "contatado"')

// resposta pelo webhook do Evolution
const hook = (secret: string, body: unknown) => fetch(`${FN}/evolution-webhook`, { method: 'POST', headers: { 'x-webhook-secret': secret, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const payload = { event: 'messages.upsert', data: { key: { remoteJid: '5511900000001@s.whatsapp.net', fromMe: false, id: `SMOKE-${Date.now()}` }, message: { conversation: 'Tenho interesse' }, messageTimestamp: Math.floor(Date.now() / 1000) } }
check((await hook('errado', payload)).status === 401, 'evolution-webhook recusa segredo errado')
check((await hook(SECRETS.evo, payload)).status === 200, 'evolution-webhook aceita a resposta')
const inbound = (await c.from('inbound_messages').select('lead_id, body').eq('lead_id', lead)).data!
check(inbound.length === 1 && inbound[0].body === 'Tenho interesse', 'resposta gravada e casada com o lead pelo telefone')
check((await c.from('leads').select('stage').eq('id', lead).single()).data!.stage === 'replied', 'lead virou "respondeu"')
await hook(SECRETS.evo, { event: 'connection.update', data: { state: 'open' } })
check((await c.from('outreach_settings').select('whatsapp_state').eq('organization_id', org).single()).data!.whatsapp_state === 'open', 'estado da conexão do WhatsApp atualizado')

// descadastro pelo link assinado
const token = await signUnsubscribe(SECRETS.unsub, org, lead)
check((await fetch(`${FN}/unsubscribe?t=${token}x`)).status === 400, 'descadastro recusa token adulterado')
check((await fetch(`${FN}/unsubscribe?t=${token}`)).status === 200, 'descadastro aceita o token')
check((await c.from('leads').select('opted_out_at').eq('id', lead).single()).data!.opted_out_at !== null, 'lead virou "não contatar"')
check(((await c.from('suppression_list').select('value').eq('value', 'smoke@ex.com')).data ?? []).length === 1, 'e-mail entrou na lista de supressão')
// rascunho com IA: sem DEEPSEEK_API_KEY no servidor nada é gerado, com ou sem a opção ligada
const draft = (headers: Record<string, string>) => fetch(`${FN}/draft-message`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ leadId: lead, templateId: lead }) })
check((await draft({})).status === 401, 'draft-message recusa sem login')
const session = (await c.auth.getSession()).data.session!
const authed = { Authorization: `Bearer ${session.access_token}`, apikey: key }
check((await draft(authed)).status === 409, 'draft-message com a IA desligada nas configurações: 409')
await c.from('outreach_settings').update({ draft_provider: 'deepseek' }).eq('organization_id', org)
check((await draft(authed)).status === 404 || (await draft(authed)).status === 409, 'draft-message ligada mas sem modelo válido/chave: nada é gerado')
check(((await c.from('outbound_messages').select('id').eq('generated_by', 'ai')).data ?? []).length === 0, 'nenhum rascunho de IA foi criado')
console.log('TUDO OK')
