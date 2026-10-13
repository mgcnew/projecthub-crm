import { useQuery } from '@tanstack/react-query'
import { addDays, dayStartInstant } from '@/lib/format'
import { supabase } from '@/lib/supabase'

// O Dashboard não mantém cópias: cada consulta lê a entidade de origem. As chaves ficam sob
// ['tasks'] e ['notifications'] para serem invalidadas junto das demais telas.

const OPEN = ['todo', 'in_progress']
const taskColumns = 'id, title, status, priority, due_date, due_at, projects(name)'
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
