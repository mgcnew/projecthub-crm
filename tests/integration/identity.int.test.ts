import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!
const PASSWORD = `Pw-${randomUUID()}`

function newClient() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function signUp(label: string) {
  const client = newClient()
  const email = `${label}-${randomUUID()}@test.local`
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD })
  expect(error).toBeNull()
  expect(data.session).not.toBeNull()
  return { client, email, userId: data.user!.id }
}

describe('identidade com sessões reais (JWT, chave publicável)', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    a = await signUp('a')
    b = await signUp('b')
  })

  it('cadastro provisiona perfil, organização pessoal e owner ativo', async () => {
    const { data, error } = await a.client
      .from('organization_members')
      .select('role, status, user_id')
    expect(error).toBeNull()
    expect(data).toEqual([{ role: 'owner', status: 'active', user_id: a.userId }])

    const orgs = await a.client.from('organizations').select('created_by')
    expect(orgs.data).toEqual([{ created_by: a.userId }])

    const profile = await a.client.from('profiles').select('id, display_name')
    expect(profile.data).toEqual([{ id: a.userId, display_name: a.email.split('@')[0] }])
  })

  it('usuário A não enxerga dados da organização B', async () => {
    const orgsA = await a.client.from('organizations').select('id, created_by')
    const orgsB = await b.client.from('organizations').select('id, created_by')
    expect(orgsA.data).toHaveLength(1)
    expect(orgsB.data).toHaveLength(1)
    expect(orgsA.data![0].id).not.toBe(orgsB.data![0].id)

    const peek = await a.client.from('organizations').select('id').eq('id', orgsB.data![0].id)
    expect(peek.data).toEqual([])
    const members = await a.client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgsB.data![0].id)
    expect(members.data).toEqual([])
  })

  it('A não altera organização, perfil ou vínculo de B', async () => {
    const orgB = (await b.client.from('organizations').select('id').single()).data!
    const upd = await a.client.from('organizations').update({ name: 'invadida' }).eq('id', orgB.id).select()
    expect(upd.data).toEqual([])
    const prof = await a.client.from('profiles').update({ display_name: 'x' }).eq('id', b.userId).select()
    expect(prof.data).toEqual([])
    const role = await a.client.from('organization_members').update({ role: 'member' }).eq('user_id', b.userId).select()
    expect(role.error?.code).toBe('42501')
  })

  it('cliente não eleva o próprio papel nem se vincula a outra organização', async () => {
    const orgB = (await b.client.from('organizations').select('id').single()).data!
    const ins = await a.client
      .from('organization_members')
      .insert({ organization_id: orgB.id, user_id: a.userId, role: 'owner' })
    expect(ins.error?.code).toBe('42501')
    const del = await a.client.from('organization_members').delete().eq('user_id', a.userId)
    expect(del.error?.code).toBe('42501')
  })

  it('owner edita apenas o nome da própria organização; slug é imutável', async () => {
    const ok = await a.client.from('organizations').update({ name: 'Minha casa' }).eq('created_by', a.userId).select('name')
    expect(ok.data).toEqual([{ name: 'Minha casa' }])
    const slug = await a.client.from('organizations').update({ slug: 'hack' }).eq('created_by', a.userId)
    expect(slug.error?.code).toBe('42501')
  })

  it('anônimo não lê nenhuma tabela de identidade', async () => {
    const anon = newClient()
    for (const table of ['organizations', 'organization_members', 'profiles'] as const) {
      const r = await anon.from(table).select('*')
      expect(r.error?.code, table).toBe('42501')
    }
  })

  it('schema private não é exposto pela API e funções privilegiadas não são chamáveis', async () => {
    const rpc = await (a.client as SupabaseClient).rpc('ensure_personal_workspace', { p_user_id: a.userId })
    expect(rpc.error).not.toBeNull()
    const priv = await (a.client as SupabaseClient).schema('private' as never).from('x' as never).select()
    expect(priv.error).not.toBeNull()
  })

  it('usuário de seed local consegue entrar e tem organização', async () => {
    const dev = newClient()
    const { error } = await dev.auth.signInWithPassword({
      email: 'dev@projecthub.local',
      password: 'DevLocal#2026',
    })
    expect(error).toBeNull()
    const orgs = await dev.from('organizations').select('name')
    expect(orgs.data).toHaveLength(1)
  })
})
