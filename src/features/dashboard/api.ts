import { useQuery } from '@tanstack/react-query'
import { addDays, dayStartInstant } from '@/lib/format'
import { supabase } from '@/lib/supabase'

// O Dashboard não mantém cópias: cada consulta lê a entidade de origem. As chaves ficam sob
// ['tasks'] e ['notifications'] para serem invalidadas junto das demais telas.

const OPEN = ['todo', 'in_progress']
const taskColumns = 'id, title, status, priority, due_date, due_at, project_id, projects(name)'
const isoNoMs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Tarefas abertas com prazo vencido (data anterior a hoje ou hora já passada). */
export function useOverdueTasks(today: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'dashboard', 'overdue', today],
    enabled,
    queryFn: async () => {
      const now = isoNoMs(new Date())
      const { data, error, count } = await supabase
        .from('tasks')
        .select(taskColumns, { count: 'exact' })
        .in('status', OPEN)
        .or(`due_date.lt.${today},due_at.lt.${now}`)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(8)
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

/** Tarefas abertas com prazo de hoje até `days` dias à frente (sem as vencidas). */
export function useUpcomingTasks(today: string, endDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'dashboard', 'upcoming', today, endDate],
    enabled,
    queryFn: async () => {
      const now = isoNoMs(new Date())
      const endIso = isoNoMs(new Date(dayStartInstant(addDays(endDate, 1))))
      const { data, error } = await supabase
        .from('tasks')
        .select(taskColumns)
        .in('status', OPEN)
        .or(
          `and(due_date.gte.${today},due_date.lte.${endDate}),and(due_at.gte.${now},due_at.lt.${endIso})`,
        )
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(8)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRecentUnread(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'dashboard'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, created_at, task_id, event_id')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useActiveProjectCount(enabled: boolean) {
  return useQuery({
    queryKey: ['projects', 'dashboard', 'active-count'],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('archived_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

type ActivityRow = {
  id: string
  actor_id: string | null
  entity_type: 'task' | 'project' | 'client' | 'calendar_event'
  entity_id: string
  action: string
  changes: unknown
  created_at: string
}

/**
 * Atividade recente da organização (activity_logs) com o título atual de cada entidade, resolvido
 * no momento da leitura por uma consulta por tipo presente (RLS aplicada; sem cópias, D052).
 * Chave sob ['tasks'] para atualizar quando tarefas mudam nesta tela; demais mudanças entram ao remontar.
 */
export function useRecentActivity(enabled: boolean, limit = 8) {
  return useQuery({
    queryKey: ['tasks', 'activity-feed', limit],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, actor_id, entity_type, entity_id, action, changes, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      const rows = (data ?? []) as ActivityRow[]
      const ids = (t: ActivityRow['entity_type']) => [...new Set(rows.filter((r) => r.entity_type === t).map((r) => r.entity_id))]
      const entities = new Map<
        string,
        { title: string | null; projectId: string | null; projectName: string | null; eventType?: string | null }
      >()
      const nameOf = (rel: unknown) => (rel as { name: string } | null)?.name ?? null

      const [tasks, projects, clients, events] = await Promise.all([
        ids('task').length ? supabase.from('tasks').select('id, title, project_id, projects(name)').in('id', ids('task')) : null,
        ids('project').length ? supabase.from('projects').select('id, name').in('id', ids('project')) : null,
        ids('client').length ? supabase.from('clients').select('id, name').in('id', ids('client')) : null,
        ids('calendar_event').length
          ? supabase.from('calendar_events').select('id, title, event_type, project_id, projects(name)').in('id', ids('calendar_event'))
          : null,
      ])
      for (const r of [tasks, projects, clients, events]) if (r?.error) throw r.error
      for (const t of tasks?.data ?? [])
        entities.set(t.id, { title: t.title, projectId: t.project_id, projectName: nameOf(t.projects) })
      for (const p of projects?.data ?? []) entities.set(p.id, { title: p.name, projectId: p.id, projectName: p.name })
      for (const c of clients?.data ?? []) entities.set(c.id, { title: c.name, projectId: null, projectName: null })
      for (const e of events?.data ?? [])
        entities.set(e.id, { title: e.title, projectId: e.project_id, projectName: nameOf(e.projects), eventType: e.event_type })

      return rows.map((r) => ({ ...r, entity: entities.get(r.entity_id) ?? null }))
    },
  })
}

/**
 * Totais exatos para os cartões da Central do dia (as listas abaixo deles são limitadas). Chaves sob
 * ['finance'] e ['follow-ups'] para acompanhar as invalidações das telas de origem.
 */
export function useReceivablesSummary(today: string, endDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['finance', 'receivables-summary', today, endDate],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments')
        .select('amount_cents, due_date, projects(currency)')
        .eq('status', 'pending')
        .lte('due_date', endDate)
      if (error) throw error
      const rows = (data ?? []) as unknown as { amount_cents: number; due_date: string; projects: { currency: string } | null }[]
      const totals = new Map<string, number>()
      for (const r of rows) {
        const cur = r.projects?.currency ?? 'BRL'
        totals.set(cur, (totals.get(cur) ?? 0) + r.amount_cents)
      }
      return { totals: [...totals], count: rows.length, overdueCount: rows.filter((r) => r.due_date < today).length }
    },
  })
}

export function useFollowUpSummary(today: string, endDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['follow-ups', 'summary', today, endDate],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('next_contact_on')
        .is('archived_at', null)
        .not('next_contact_on', 'is', null)
        .lte('next_contact_on', endDate)
      if (error) throw error
      const rows = data ?? []
      return { count: rows.length, overdueCount: rows.filter((r) => (r.next_contact_on ?? '') < today).length }
    },
  })
}
