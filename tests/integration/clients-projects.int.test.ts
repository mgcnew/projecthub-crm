import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!

async function signUp(label: string) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signUp({
    email: `${label}-${randomUUID()}@test.local`,
    password: `Pw-${randomUUID()}`,
  })
  expect(error).toBeNull()
  const org = await client.from('organizations').select('id').single()
  return { client, userId: data.user!.id, orgId: org.data!.id as string }
}

describe('clientes e projetos com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    a = await signUp('a')
    b = await signUp('b')
  })

  it('owner cria cliente, projeto com e sem cliente e registra histórico', async () => {
    const c = await a.client
      .from('clients')
      .insert({ organization_id: a.orgId, name: 'Acme', email: 'x@acme.com' })
      .select('id')
      .single()
    expect(c.error).toBeNull()

    const withClient = await a.client
      .from('projects')
      .insert({ organization_id: a.orgId, name: 'Site', client_id: c.data!.id, target_date: '2026-12-01' })
      .select('id, clients(name)')
      .single()
    expect(withClient.error).toBeNull()

    const solo = await a.client.from('projects').insert({ organization_id: a.orgId, name: 'Interno' }).select('id').single()
    expect(solo.error).toBeNull()

    const log = await a.client
      .from('project_logs')
      .insert({ organization_id: a.orgId, project_id: solo.data!.id, author_id: a.userId, title: 'Início' })
    expect(log.error).toBeNull()
  })

  it('arquiva e restaura sem apagar', async () => {
    const p = await a.client.from('projects').select('id').eq('name', 'Interno').single()
    const arch = await a.client.from('projects').update({ archived_at: new Date().toISOString() }).eq('id', p.data!.id)
    expect(arch.error).toBeNull()
    const active = await a.client.from('projects').select('id').is('archived_at', null)
    expect(active.data!.map((r) => r.id)).not.toContain(p.data!.id)
    const del = await a.client.from('projects').delete().eq('id', p.data!.id)
    expect(del.error?.code).toBe('42501')
  })

  it('B não vê nem usa dados de A', async () => {
    const clientsB = await b.client.from('clients').select('id')
    expect(clientsB.data).toEqual([])
    const projectsB = await b.client.from('projects').select('id')
    expect(projectsB.data).toEqual([])

    const aClient = (await a.client.from('clients').select('id').single()).data!
    const cross = await b.client
      .from('projects')
      .insert({ organization_id: b.orgId, name: 'cruzado', client_id: aClient.id })
    expect(cross.error?.code).toBe('23503')

    const invade = await b.client.from('clients').insert({ organization_id: a.orgId, name: 'invasor' })
    expect(invade.error?.code).toBe('42501')

    const move = await a.client.from('clients').update({ organization_id: b.orgId }).eq('id', aClient.id)
    expect(move.error?.code).toBe('42501')
  })
})
