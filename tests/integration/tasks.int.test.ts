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

describe('tarefas, planejamento e checklists com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    a = await signUp('a')
    b = await signUp('b')
  })

  it('captura rápida, prazo exclusivo e conclusão', async () => {
    const t = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'Ligar para o cliente' })
      .select('id, status, completed_at')
      .single()
    expect(t.error).toBeNull()
    expect(t.data).toMatchObject({ status: 'todo', completed_at: null })

    const both = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'x', due_date: '2026-11-01', due_at: new Date().toISOString() })
    expect(both.error?.code).toBe('23514')

    const done = await a.client.from('tasks').update({ status: 'done' }).eq('id', t.data!.id).select('completed_at').single()
    expect(done.data!.completed_at).not.toBeNull()
  })

  it('mover o planejamento não altera o prazo e duplicata é rejeitada', async () => {
    const t = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'Relatório', due_date: '2026-12-01' })
      .select('id')
      .single()
    const plan = await a.client
      .from('task_plans')
      .insert({ organization_id: a.orgId, task_id: t.data!.id, planned_date: '2026-11-10' })
      .select('id')
      .single()
    expect(plan.error).toBeNull()

    const dup = await a.client
      .from('task_plans')
      .insert({ organization_id: a.orgId, task_id: t.data!.id, planned_date: '2026-11-10' })
    expect(dup.error?.code).toBe('23505')

    const moved = await a.client.from('task_plans').update({ planned_date: '2026-11-11' }).eq('id', plan.data!.id)
    expect(moved.error).toBeNull()
    const after = await a.client.from('tasks').select('due_date').eq('id', t.data!.id).single()
    expect(after.data!.due_date).toBe('2026-12-01')
  })

  it('checklist copiado do modelo não muda retroativamente', async () => {
    const tpl = await a.client
      .from('checklist_templates')
      .insert({ organization_id: a.orgId, name: 'Entrega' })
      .select('id')
      .single()
    const item = await a.client
      .from('checklist_template_items')
      .insert({ organization_id: a.orgId, template_id: tpl.data!.id, title: 'Revisar', sort_order: 0 })
      .select('id')
      .single()
    const task = await a.client.from('tasks').insert({ organization_id: a.orgId, title: 'Entregar' }).select('id').single()

    const copy = await a.client
      .from('checklist_items')
      .insert({ organization_id: a.orgId, task_id: task.data!.id, title: 'Revisar', sort_order: 0 })
    expect(copy.error).toBeNull()

    await a.client.from('checklist_template_items').update({ title: 'Revisar (v2)' }).eq('id', item.data!.id)
    const items = await a.client.from('checklist_items').select('title').eq('task_id', task.data!.id)
    expect(items.data).toEqual([{ title: 'Revisar' }])
  })

  it('subtarefa não forma ciclo e B não acessa dados de A', async () => {
    const parent = await a.client.from('tasks').insert({ organization_id: a.orgId, title: 'Pai' }).select('id').single()
    const child = await a.client
      .from('tasks')
      .insert({ organization_id: a.orgId, title: 'Filho', parent_task_id: parent.data!.id })
      .select('id')
      .single()
    const cycle = await a.client.from('tasks').update({ parent_task_id: child.data!.id }).eq('id', parent.data!.id)
    expect(cycle.error?.code).toBe('23514')

    const seen = await b.client.from('tasks').select('id')
    expect(seen.data).toEqual([])
    const cross = await b.client
      .from('tasks')
      .insert({ organization_id: b.orgId, title: 'cruzada', parent_task_id: parent.data!.id })
    expect(cross.error?.code).toBe('23503')
    const del = await a.client.from('tasks').delete().eq('id', child.data!.id)
    expect(del.error?.code).toBe('42501')
  })
})
