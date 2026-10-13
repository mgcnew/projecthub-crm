import { useQuery } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { buildGroups } from './results'

export const SEARCH_MIN_CHARS = 2
const LIMIT = 6

/**
 * Busca global (UI_UX_SPEC): ILIKE nas entidades da organização, sob a RLS do usuário (nenhum dado de
 * outra organização é alcançável). Uma consulta por tipo, em paralelo; sem migração nem índice novo.
 */
export function useGlobalSearch(term: string) {
  const q = sanitizeSearch(term)
  return useQuery({
    queryKey: ['search', q],
    enabled: q.length >= SEARCH_MIN_CHARS,
    staleTime: 15_000,
    queryFn: async () => {
      const like = `%${q}%`
      const [tasks, projects, clients, events] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status')
          .ilike('title', like)
          .order('updated_at', { ascending: false })
          .limit(LIMIT),
        supabase.from('projects').select('id, name, status').is('archived_at', null).ilike('name', like).order('name').limit(LIMIT),
        supabase
          .from('clients')
          .select('id, name, company_name')
          .is('archived_at', null)
          .or(`name.ilike.${like},company_name.ilike.${like}`)
          .order('name')
          .limit(LIMIT),
        supabase
          .from('calendar_events')
          .select('id, title, event_type, starts_at')
          .neq('status', 'cancelled')
          .neq('event_type', 'work_block')
          .ilike('title', like)
          .order('starts_at', { ascending: false })
          .limit(LIMIT),
      ])
      for (const r of [tasks, projects, clients, events]) if (r.error) throw r.error
      return buildGroups({
        tasks: tasks.data ?? [],
        projects: projects.data ?? [],
        clients: clients.data ?? [],
        events: events.data ?? [],
      })
    },
  })
}
