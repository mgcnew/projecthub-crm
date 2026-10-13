import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!

async function signUp(label: string) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signUp({
    email: `${label}-${randomUUID()}@test.local`,
    password: `Pw-${randomUUID()}`,
  })
  expect(error).toBeNull()
  const org = await client.from('organizations').select('id').single()
  return { client, orgId: org.data!.id as string }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('lembretes e notificações com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>
  let taskId: string
  let eventId: string

  beforeAll(async () => {
    a = await signUp('a')
    b = await signUp('b')
    const t = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'Enviar proposta' })
      .select('id')
      .single()
    expect(t.error).toBeNull()
    taskId = t.data!.id
  })

  it('cria lembretes e valida regras (passado, duplicado, XOR)', async () => {
    const soon = new Date(Date.now() + 3_000).toISOString()
    const ok = await a.client.from('reminders').insert({ organization_id: a.orgId, task_id: taskId, remind_at: soon })
    expect(ok.error).toBeNull()

    const dup = await a.client.from('reminders').insert({ organization_id: a.orgId, task_id: taskId, remind_at: soon })
    expect(dup.error?.code).toBe('23505')

    const past = await a.client
      .from('reminders')
      .insert({ organization_id: a.orgId, task_id: taskId, remind_at: new Date(Date.now() - 3_600_000).toISOString() })
    expect(past.error?.code).toBe('23514')

    const none = await a.client.from('reminders').insert({ organization_id: a.orgId, remind_at: soon })
    expect(none.error?.code).toBe('23514')

    // Evento que começa em 2 min, com aviso 5 min antes: já está vencido e dispara no próximo ciclo.
    const start = new Date(Date.now() + 120_000)
    const ev = await a.client
      .from('calendar_events')
      .insert({
        organization_id: a.orgId,
        title: 'Alinhamento',
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
        timezone: 'America/Sao_Paulo',
      })
      .select('id')
      .single()
    expect(ev.error).toBeNull()
    eventId = ev.data!.id
    const r = await a.client.from('reminders').insert({ organization_id: a.orgId, event_id: eventId, offset_minutes: 5 })
    expect(r.error).toBeNull()
  })

  it('o worker do pg_cron gera as notificações sem duplicar', async () => {
    const deadline = Date.now() + 100_000
    let rows: Array<{ id: string; task_id: string | null; event_id: string | null; title: string }> = []
    while (Date.now() < deadline) {
      const res = await a.client.from('notifications').select('id, task_id, event_id, title')
      expect(res.error).toBeNull()
      rows = res.data ?? []
      if (rows.length >= 2) break
      await sleep(5_000)
    }
    expect(rows).toHaveLength(2)
    expect(rows.find((n) => n.task_id === taskId)?.title).toBe('Enviar proposta')
    expect(rows.find((n) => n.event_id === eventId)?.title).toBe('Alinhamento')
  }, 130_000)

  it('só o dono lê e só altera read_at; B é isolado', async () => {
    const own = await a.client.from('notifications').select('id').limit(1).single()
    expect(own.error).toBeNull()

    const bSees = await b.client.from('notifications').select('id')
    expect(bSees.data).toEqual([])
    const bUpdate = await b.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', own.data!.id).select('id')
    expect(bUpdate.data).toEqual([])
    const bReminders = await b.client.from('reminders').select('id')
    expect(bReminders.data).toEqual([])

    const title = await a.client.from('notifications').update({ title: 'forjado' }).eq('id', own.data!.id)
    expect(title.error?.code).toBe('42501')
    const forged = await a.client
      .from('notifications')
      .insert({ organization_id: a.orgId, user_id: (await a.client.auth.getUser()).data.user!.id, occurrence_at: new Date().toISOString(), title: 'x' })
    expect(forged.error?.code).toBe('42501')
    const del = await a.client.from('notifications').delete().eq('id', own.data!.id)
    expect(del.error?.code).toBe('42501')
    const deliveries = await a.client.from('notification_deliveries').select('id')
    expect(deliveries.error?.code).toBe('42501')

    const read = await a.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .select('id')
    expect(read.error).toBeNull()
    expect(read.data).toHaveLength(2)
    const unread = await a.client.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
    expect(unread.count).toBe(0)
  })

  it('B não cria lembrete para tarefa de A e anon não acessa', async () => {
    const cross = await b.client
      .from('reminders')
      .insert({ organization_id: b.orgId, task_id: taskId, remind_at: new Date(Date.now() + 3_600_000).toISOString() })
    expect(cross.error?.code).toBe('23503')

    const anon = createClient(url, key, { auth: { persistSession: false } })
    const denied = await anon.from('notifications').select('id')
    expect(denied.error).not.toBeNull()
  })
})
