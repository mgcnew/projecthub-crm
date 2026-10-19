import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!
const PASSWORD = `Pw-${randomUUID()}`
const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function signUp(label: string) {
  const client = newClient()
  const { error } = await client.auth.signUp({ email: `${label}-${randomUUID()}@test.local`, password: PASSWORD })
  expect(error).toBeNull()
  const org = await client.from('organizations').select('id').single()
  return { client, orgId: org.data!.id as string }
}

describe('leads e supressão com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>
  let leadId: string

  beforeAll(async () => {
    a = await signUp('lead-a')
    b = await signUp('lead-b')
  })

  it('cria lead frio e novo, com e-mail normalizado', async () => {
    const r = await a.client
      .from('leads')
      .insert({ organization_id: a.orgId, company_name: 'Padaria Sol', email: 'Contato@Sol.com', phone: '+5511912345678', source: 'Planilha' })
      .select('id, email, temperature, stage')
      .single()
    expect(r.error).toBeNull()
    expect(r.data).toMatchObject({ email: 'contato@sol.com', temperature: 'cold', stage: 'new' })
    leadId = r.data!.id
  })

  it('duplicado devolve 23505 com o nome da restrição (o front traduz por ele)', async () => {
    const email = await a.client.from('leads').insert({ organization_id: a.orgId, company_name: 'X', email: 'CONTATO@sol.com', source: 'x' })
    expect(email.error?.code).toBe('23505')
    expect(email.error?.message).toContain('leads_org_email_key')
    const phone = await a.client.from('leads').insert({ organization_id: a.orgId, company_name: 'Y', phone: '+5511912345678', source: 'x' })
    expect(phone.error?.code).toBe('23505')
    expect(phone.error?.message).toContain('leads_org_phone_key')
  })

  it('o cliente não escreve has_whatsapp (é do servidor)', async () => {
    const r = await a.client.from('leads').update({ has_whatsapp: true } as never).eq('id', leadId)
    expect(r.error?.code).toBe('42501')
  })

  it('"não contatar" suprime e-mail e telefone; reativar desfaz só as manuais', async () => {
    await a.client.from('leads').update({ opted_out_at: new Date().toISOString() }).eq('id', leadId)
    const sup = await a.client.from('suppression_list').select('channel, value, reason').order('value')
    expect(sup.data).toEqual([
      { channel: 'all', value: '+5511912345678', reason: 'manual' },
      { channel: 'all', value: 'contato@sol.com', reason: 'manual' },
    ])
    const bad = await a.client.from('suppression_list').insert({ organization_id: a.orgId, channel: 'email', value: 'x@y.com', reason: 'opt_out' })
    expect(bad.error?.code).toBe('42501')

    await a.client.from('leads').update({ opted_out_at: null }).eq('id', leadId)
    const del = await a.client.from('suppression_list').delete().eq('reason', 'manual').in('value', ['contato@sol.com', '+5511912345678']).select('id')
    expect(del.data).toHaveLength(2)
  })

  it('B não enxerga, não altera nem cria lead na organização de A', async () => {
    expect((await b.client.from('leads').select('id')).data).toEqual([])
    const upd = await b.client.from('leads').update({ temperature: 'hot' }).eq('id', leadId).select('id')
    expect(upd.data).toEqual([])
    const cross = await b.client.from('leads').insert({ organization_id: a.orgId, company_name: 'Invasão', source: 'x' })
    expect(cross.error?.code).toBe('42501')
  })

  it('configuração de envio com os padrões conservadores', async () => {
    const r = await a.client.from('outreach_settings').insert({ organization_id: a.orgId }).select('*').single()
    expect(r.error).toBeNull()
    expect(r.data).toMatchObject({ email_daily_limit: 50, whatsapp_daily_limit: 20, weekdays_only: true, paused: false, draft_provider: 'none' })
  })
})
