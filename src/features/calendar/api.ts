import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { emptyToNull } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import {
  browserTimezone,
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
      const timezone = browserTimezone()
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
      const timezone = browserTimezone()
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
        .select('id, title, starts_at, status, project_id, client_id', { count: 'exact' })
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
        timezone: browserTimezone(),
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
