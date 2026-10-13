import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { totp } from '../support/totp'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!
const PASSWORD = `Pw-${randomUUID()}`

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function signUp(label: string) {
  const client = newClient()
  const email = `${label}-${randomUUID()}@test.local`
  const { error } = await client.auth.signUp({ email, password: PASSWORD })
  expect(error).toBeNull()
  const org = await client.from('organizations').select('id').single()
  return { client, email, orgId: org.data!.id as string }
}

describe('diretório de acessos com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>
  let projectA: string
  let accessId: string

  beforeAll(async () => {
    a = await signUp('acc-a')
    b = await signUp('acc-b')
    const p = await a.client.from('projects').insert({ organization_id: a.orgId, name: 'Projeto A' }).select('id').single()
    projectA = p.data!.id
  })

  it('cria, lê com o nome do projeto embutido e edita', async () => {
    const ins = await a.client
      .from('access_entries')
      .insert({
        organization_id: a.orgId,
        project_id: projectA,
        name: 'Supabase',
        url: 'https://supabase.com/dashboard',
        username: 'eu@exemplo.com',
        manager_item: 'Supabase (pessoal)',
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    accessId = ins.data!.id

    const list = await a.client.from('access_entries').select('id, name, projects(name), clients(name)')
    expect(list.error).toBeNull()
    expect(list.data).toEqual([{ id: accessId, name: 'Supabase', projects: { name: 'Projeto A' }, clients: null }])

    const upd = await a.client.from('access_entries').update({ username: 'outro@exemplo.com' }).eq('id', accessId)
    expect(upd.error).toBeNull()
  })

  it('rejeita URL que não é http(s)', async () => {
    const bad = await a.client
      .from('access_entries')
      .insert({ organization_id: a.orgId, name: 'Mau', url: 'javascript:alert(1)' })
    expect(bad.error?.code).toBe('23514')
  })

  it('B não enxerga nem altera nem apaga os acessos de A', async () => {
    const list = await b.client.from('access_entries').select('id')
    expect(list.data).toEqual([])
    const upd = await b.client.from('access_entries').update({ name: 'Invadido' }).eq('id', accessId).select('id')
    expect(upd.data).toEqual([])
    const del = await b.client.from('access_entries').delete().eq('id', accessId).select('id')
    expect(del.data).toEqual([])
    const still = await a.client.from('access_entries').select('name').eq('id', accessId).single()
    expect(still.data!.name).toBe('Supabase')
  })

  it('B não referencia o projeto de A nem grava na organização de A', async () => {
    const fk = await b.client
      .from('access_entries')
      .insert({ organization_id: b.orgId, name: 'Cruzado', project_id: projectA })
    expect(fk.error?.code).toBe('23503')
    const cross = await b.client.from('access_entries').insert({ organization_id: a.orgId, name: 'Invasão' })
    expect(cross.error?.code).toBe('42501')
  })

  it('com MFA ativo, a sessão aal1 não lê os acessos (D082)', async () => {
    const enroll = await a.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'App' })
    const ch = await a.client.auth.mfa.challenge({ factorId: enroll.data!.id })
    const ok = await a.client.auth.mfa.verify({
      factorId: enroll.data!.id,
      challengeId: ch.data!.id,
      code: totp(enroll.data!.totp.secret),
    })
    expect(ok.error).toBeNull()
    expect((await a.client.from('access_entries').select('id')).data).toHaveLength(1)

    const weak = newClient()
    await weak.auth.signInWithPassword({ email: a.email, password: PASSWORD })
    expect((await weak.from('access_entries').select('id')).data).toEqual([])
  })

  it('o owner apaga o próprio acesso', async () => {
    const del = await a.client.from('access_entries').delete().eq('id', accessId).select('id')
    expect(del.error).toBeNull()
    expect(del.data).toEqual([{ id: accessId }])
  })
})
