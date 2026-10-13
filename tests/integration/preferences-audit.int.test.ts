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

describe('preferências e trilha de atividades com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    a = await signUp('a')
    b = await signUp('b')
  })

  it('fuso: atualiza sem linha, cria, valida e isola', async () => {
    const miss = await a.client.from('user_preferences').update({ timezone: 'UTC' }).eq('user_id', a.userId).select('user_id')
    expect(miss.error).toBeNull()
    expect(miss.data).toEqual([])

    const created = await a.client.from('user_preferences').insert({ user_id: a.userId, timezone: 'America/Sao_Paulo' })
    expect(created.error).toBeNull()

    const bad = await a.client.from('user_preferences').update({ timezone: 'Mars/Olympus' }).eq('user_id', a.userId)
    expect(bad.error?.code).toBe('23514')

    const ok = await a.client.from('user_preferences').update({ timezone: 'Europe/Lisbon' }).eq('user_id', a.userId).select('timezone')
    expect(ok.data).toEqual([{ timezone: 'Europe/Lisbon' }])

    const forged = await a.client.from('user_preferences').insert({ user_id: b.userId, timezone: 'UTC' })
    expect(forged.error?.code).toBe('42501')

    const seen = await b.client.from('user_preferences').select('timezone')
    expect(seen.data).toEqual([])
  })

  it('trilha: criação e alteração registradas, imutável e isolada', async () => {
    const task = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'Revisar contrato' })
      .select('id')
      .single()
    expect(task.error).toBeNull()
    const upd = await a.client.from('tasks').update({ title: 'Revisar contrato v2', priority: 'high' }).eq('id', task.data!.id)
    expect(upd.error).toBeNull()

    const logs = await a.client
      .from('activity_logs')
      .select('action, actor_id, changes')
      .eq('entity_id', task.data!.id)
      .order('created_at')
    expect(logs.error).toBeNull()
    expect(logs.data!.map((l) => l.action)).toEqual(['created', 'updated'])
    expect(logs.data![0].actor_id).toBe(a.userId)
    expect(Object.keys(logs.data![1].changes as object).sort()).toEqual(['priority', 'title'])

    const forged = await a.client
      .from('activity_logs')
      .insert({ organization_id: a.orgId, entity_type: 'task', entity_id: task.data!.id, action: 'created' })
    expect(forged.error?.code).toBe('42501')
    const del = await a.client.from('activity_logs').delete().eq('entity_id', task.data!.id)
    expect(del.error?.code).toBe('42501')

    const bSees = await b.client.from('activity_logs').select('id').eq('entity_id', task.data!.id)
    expect(bSees.data).toEqual([])
  })
})
