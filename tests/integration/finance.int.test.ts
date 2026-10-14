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

describe('financeiro do projeto com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>
  let projectId: string
  let advanceId: string

  beforeAll(async () => {
    a = await signUp('fin-a')
    b = await signUp('fin-b')
    const c = await a.client.from('clients').insert({ organization_id: a.orgId, name: 'Cliente Fin' }).select('id').single()
    const p = await a.client
      .from('projects')
      .insert({
        organization_id: a.orgId,
        client_id: c.data!.id,
        name: 'Projeto Fin',
        contract_value_cents: 500000,
        currency: 'USD',
        billing_model: 'monthly',
      })
      .select('id, contract_value_cents, currency, billing_model')
      .single()
    expect(p.error).toBeNull()
    expect(p.data).toMatchObject({ contract_value_cents: 500000, currency: 'USD', billing_model: 'monthly' })
    projectId = p.data!.id
  })

  it('cria adiantamento e saldo, e lê com projeto e cliente embutidos', async () => {
    const adv = await a.client
      .from('project_payments')
      .insert({ organization_id: a.orgId, project_id: projectId, kind: 'advance', amount_cents: 150000, due_date: '2026-11-01' })
      .select('id')
      .single()
    expect(adv.error).toBeNull()
    advanceId = adv.data!.id
    const fin = await a.client
      .from('project_payments')
      .insert({ organization_id: a.orgId, project_id: projectId, kind: 'final', amount_cents: 350000, due_date: '2026-12-15' })
    expect(fin.error).toBeNull()

    const list = await a.client
      .from('project_payments')
      .select('id, amount_cents, projects(name, currency, clients(name))')
      .eq('status', 'pending')
      .order('due_date')
    expect(list.error).toBeNull()
    expect(list.data).toHaveLength(2)
    expect(list.data![0]).toMatchObject({
      amount_cents: 150000,
      projects: { name: 'Projeto Fin', currency: 'USD', clients: { name: 'Cliente Fin' } },
    })
  })

  it('valores restritos: centavos positivos e recebida exige data', async () => {
    const zero = await a.client
      .from('project_payments')
      .insert({ organization_id: a.orgId, project_id: projectId, amount_cents: 0, due_date: '2026-11-01' })
    expect(zero.error?.code).toBe('23514')
    const noDate = await a.client.from('project_payments').update({ status: 'paid' }).eq('id', advanceId)
    expect(noDate.error?.code).toBe('23514')
  })

  it('marca como recebida, e recebida não se exclui', async () => {
    const paid = await a.client.from('project_payments').update({ status: 'paid', paid_on: '2026-11-02' }).eq('id', advanceId)
    expect(paid.error).toBeNull()
    const del = await a.client.from('project_payments').delete().eq('id', advanceId).select('id')
    expect(del.data).toEqual([])
    const back = await a.client.from('project_payments').update({ status: 'pending', paid_on: null }).eq('id', advanceId)
    expect(back.error).toBeNull()
  })

  it('a moeda do projeto com parcelas não muda', async () => {
    const r = await a.client.from('projects').update({ currency: 'EUR' }).eq('id', projectId)
    expect(r.error?.code).toBe('23514')
  })

  it('valor e moeda não vão para a trilha de atividade', async () => {
    const logs = await a.client.from('activity_logs').select('changes').eq('entity_id', projectId)
    const text = JSON.stringify(logs.data)
    expect(text).not.toMatch(/contract_value_cents|currency|billing_model/)
  })

  it('B não enxerga, não altera e não referencia o projeto de A', async () => {
    expect((await b.client.from('project_payments').select('id')).data).toEqual([])
    const upd = await b.client.from('project_payments').update({ amount_cents: 1 }).eq('id', advanceId).select('id')
    expect(upd.data).toEqual([])
    const fk = await b.client
      .from('project_payments')
      .insert({ organization_id: b.orgId, project_id: projectId, amount_cents: 100, due_date: '2026-11-01' })
    expect(fk.error?.code).toBe('23503')
  })
})
