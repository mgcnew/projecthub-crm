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

describe('agenda e reuniões com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    a = await signUp('a')
    b = await signUp('b')
  })

  it('série semanal em Nova York mantém 09:00 local após o horário de verão', async () => {
    const rule = await a.client
      .from('recurrence_rules')
      .insert({ organization_id: a.orgId, frequency: 'weekly', starts_on: '2026-03-02', timezone: 'America/New_York' })
      .select('id')
      .single()
    expect(rule.error).toBeNull()
    const ev = await a.client.from('calendar_events').insert({
      organization_id: a.orgId,
      title: 'Call NY',
      starts_at: '2026-03-02T14:00:00Z',
      ends_at: '2026-03-02T15:00:00Z',
      timezone: 'America/New_York',
      recurrence_rule_id: rule.data!.id,
    })
    expect(ev.error).toBeNull()

    const occ = await a.client.rpc('list_calendar_occurrences', { p_from: '2026-03-01T00:00:00Z', p_to: '2026-03-20T00:00:00Z' })
    expect(occ.error).toBeNull()
    const starts = (occ.data as Array<{ occurrence_start: string }>).map((o) => new Date(o.occurrence_start).toISOString())
    expect(starts).toEqual(['2026-03-02T14:00:00.000Z', '2026-03-09T13:00:00.000Z', '2026-03-16T13:00:00.000Z'])
  })

  it('reunião é criada com o evento e aceita pauta, notas e decisões', async () => {
    const ev = await a.client
      .from('calendar_events')
      .insert({
        organization_id: a.orgId,
        title: 'Kickoff',
        event_type: 'meeting',
        starts_at: '2026-11-06T15:00:00Z',
        ends_at: '2026-11-06T16:00:00Z',
        timezone: 'UTC',
      })
      .select('id')
      .single()
    expect(ev.error).toBeNull()
    const m = await a.client.from('meetings').select('id').eq('calendar_event_id', ev.data!.id).single()
    expect(m.error).toBeNull()
    const upd = await a.client.from('meetings').update({ agenda: 'Pauta', decisions: 'Seguir' }).eq('id', m.data!.id)
    expect(upd.error).toBeNull()
    const direct = await a.client
      .from('meetings')
      .insert({ organization_id: a.orgId, calendar_event_id: ev.data!.id })
    expect(direct.error?.code).toBe('42501')
  })

  it('múltiplos work blocks para a mesma tarefa sem alterar o prazo', async () => {
    const task = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'Escrever relatório', due_date: '2026-12-15' })
      .select('id')
      .single()
    for (const day of ['2026-12-01', '2026-12-02']) {
      const wb = await a.client.from('calendar_events').insert({
        organization_id: a.orgId,
        task_id: task.data!.id,
        event_type: 'work_block',
        title: 'Foco',
        starts_at: `${day}T13:00:00Z`,
        ends_at: `${day}T15:00:00Z`,
        timezone: 'UTC',
      })
      expect(wb.error).toBeNull()
    }
    const blocks = await a.client.from('calendar_events').select('id').eq('task_id', task.data!.id)
    expect(blocks.data).toHaveLength(2)
    const t = await a.client.from('tasks').select('due_date').eq('id', task.data!.id).single()
    expect(t.data!.due_date).toBe('2026-12-15')
  })

  it('fuso inválido é rejeitado e B não vê a agenda de A', async () => {
    const bad = await a.client.from('calendar_events').insert({
      organization_id: a.orgId,
      title: 'x',
      starts_at: '2026-11-06T15:00:00Z',
      ends_at: '2026-11-06T16:00:00Z',
      timezone: 'Mars/Olympus',
    })
    expect(bad.error?.code).toBe('23514')

    const seen = await b.client.rpc('list_calendar_occurrences', { p_from: '2026-01-01T00:00:00Z', p_to: '2026-03-31T00:00:00Z' })
    expect(seen.data).toEqual([])
    const anon = createClient(url, key, { auth: { persistSession: false } })
    const denied = await anon.rpc('list_calendar_occurrences', { p_from: '2026-01-01T00:00:00Z', p_to: '2026-02-01T00:00:00Z' })
    expect(denied.error).not.toBeNull()
  })
})
