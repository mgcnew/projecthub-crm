import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activeTimezone, emptyToNull } from '@/lib/format'
import { clientScopeFilter, type LinkScope } from '@/features/tasks/api'
import { supabase } from '@/lib/supabase'
import {
  eventPayload,
  rulePayload,
  type EventFormValues,
  type MeetingFormValues,
} from './schema'

export function useOccurrences(fromISO: string, toISO: string, enabled: boolean) {
  return useQuery({
    queryKey: ['calendar', 'occurrences', fromISO, toISO],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_calendar_occurrences', { p_from: fromISO, p_to: toISO })
      if (error) throw error
      return data ?? []
    },
  })
}

type LinkedEvent = {
  id: string
  title: string
  event_type: string
  starts_at: string
  ends_at: string
  timezone: string
  recurrence_rule_id: string | null
}

/** Próximos (inclui séries recorrentes, por início crescente; até 6) e anteriores (até 3). */
export function splitUpcoming(events: LinkedEvent[], now: number) {
  const isUpcoming = (e: LinkedEvent) => Boolean(e.recurrence_rule_id) || new Date(e.ends_at).getTime() >= now
  const upcoming = events
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 6)
  const past = events.filter((e) => !isUpcoming(e)).slice(0, 3)
  return { upcoming, past, total: events.length }
}

/**
 * Eventos e reuniões do projeto/cliente (exceto blocos de foco e cancelados), os 30 de início mais recente.
 * A divisão em próximos/anteriores é feita no componente; séries recorrentes contam como próximas.
 */
export function useLinkedEvents(scope: LinkScope, enabled = true) {
  return useQuery({
    queryKey: ['calendar', 'linked', scope],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from('calendar_events')
        .select('id, title, event_type, starts_at, ends_at, timezone, recurrence_rule_id')
        .neq('status', 'cancelled')
        .neq('event_type', 'work_block')
        .order('starts_at', { ascending: false })
        .limit(30)
      q = 'projectId' in scope ? q.eq('project_id', scope.projectId) : q.or(clientScopeFilter(scope.clientId, scope.projectIds))
      const { data, error } = await q
      if (error) throw error
      return splitUpcoming(data ?? [], Date.now())
    },
  })
}

/**
 * Projeto das tarefas dos blocos de foco: a ocorrência traz só o task_id, e o bloco deve correr na
 * linha do projeto da tarefa (não em Prata).
 */
export function useWorkBlockProjects(occurrences: { event_type: string; task_id: string | null }[] | undefined) {
  const ids = [...new Set((occurrences ?? []).filter((o) => o.event_type === 'work_block' && o.task_id).map((o) => o.task_id!))].sort()
  return useQuery({
    queryKey: ['tasks', 'work-block-projects', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('id, project_id').in('id', ids)
      if (error) throw error
      return new Map((data ?? []).map((t) => [t.id, t.project_id as string | null]))
    },
  })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['calendar', 'event', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, recurrence_rules(*), meetings(id)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['calendar'] })
}

export function useCreateEvent(orgId: string | undefined) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (v: EventFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const timezone = activeTimezone()
      let ruleId: string | null = null
      if (v.frequency !== 'none') {
        const { data, error } = await supabase
          .from('recurrence_rules')
          .insert({
            organization_id: orgId,
            ...rulePayload(v),
            starts_on: v.start_at.slice(0, 10),
            timezone,
          })
          .select('id')
          .single()
        if (error) throw error
        ruleId = data.id
      }
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          organization_id: orgId,
          event_type: v.event_type,
          timezone,
          recurrence_rule_id: ruleId,
          ...eventPayload(v),
        })
        .select('id, event_type')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateEvent(orgId: string | undefined, eventId: string, currentRuleId: string | null) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (v: EventFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const timezone = activeTimezone()
      let ruleId = currentRuleId
      if (v.frequency === 'none') {
        ruleId = null
      } else if (currentRuleId) {
        const { error } = await supabase.from('recurrence_rules').update({ ...rulePayload(v), is_active: true }).eq('id', currentRuleId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('recurrence_rules')
          .insert({ organization_id: orgId, ...rulePayload(v), starts_on: v.start_at.slice(0, 10), timezone })
          .select('id')
          .single()
        if (error) throw error
        ruleId = data.id
      }
      const { error } = await supabase
        .from('calendar_events')
        .update({ ...eventPayload(v), timezone, recurrence_rule_id: ruleId })
        .eq('id', eventId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useMeetings(page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: ['calendar', 'meetings', page],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('calendar_events')
        .select('id, title, starts_at, status, project_id, client_id, projects(name)', { count: 'exact' })
        .eq('event_type', 'meeting')
        .order('starts_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

export function useMeeting(eventId: string | undefined) {
  return useQuery({
    queryKey: ['calendar', 'meeting', eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, agenda, notes, decisions, updated_at, calendar_events(id, title, starts_at, ends_at, status)')
        .eq('calendar_event_id', eventId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateMeeting(meetingId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (v: MeetingFormValues) => {
      const { error } = await supabase
        .from('meetings')
        .update({ agenda: emptyToNull(v.agenda), notes: emptyToNull(v.notes), decisions: emptyToNull(v.decisions) })
        .eq('id', meetingId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useMeetingTasks(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'by-meeting', meetingId],
    enabled: Boolean(meetingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('meeting_id', meetingId!)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateMeetingTask(orgId: string | undefined, meetingId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      if (!orgId || !meetingId) throw new Error('Reunião não carregada')
      const { error } = await supabase
        .from('tasks')
        .insert({ organization_id: orgId, title: title.trim(), meeting_id: meetingId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// ------------------------------------------------------------ work blocks
export function useWorkBlocks(taskId: string) {
  return useQuery({
    queryKey: ['calendar', 'work-blocks', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, starts_at, ends_at, status')
        .eq('task_id', taskId)
        .eq('event_type', 'work_block')
        .neq('status', 'cancelled')
        .order('starts_at')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateWorkBlock(orgId: string | undefined, taskId: string, title: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ startsAt, endsAt }: { startsAt: string; endsAt: string }) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase.from('calendar_events').insert({
        organization_id: orgId,
        task_id: taskId,
        event_type: 'work_block',
        title: `Foco: ${title}`.slice(0, 300),
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: activeTimezone(),
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useCancelEvent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
