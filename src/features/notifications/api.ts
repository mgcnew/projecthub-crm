import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export const NOTIFICATIONS_PAGE_SIZE = 20

export type ReminderTarget = { kind: 'task' | 'event'; id: string }

const targetColumn = (t: ReminderTarget) => (t.kind === 'task' ? 'task_id' : 'event_id')

// ------------------------------------------------------------- lembretes
export function useReminders(target: ReminderTarget) {
  return useQuery({
    queryKey: ['notifications', 'reminders', target.kind, target.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('id, remind_at, offset_minutes')
        .eq(targetColumn(target), target.id)
        .eq('status', 'active')
        .order('remind_at', { ascending: true, nullsFirst: false })
        .order('offset_minutes', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useReminderMutations(orgId: string | undefined, target: ReminderTarget) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['notifications', 'reminders', target.kind, target.id] })

  const create = useMutation({
    mutationFn: async (v: { remindAt: string } | { offsetMinutes: number }) => {
      if (!orgId) throw new Error('Organização não carregada')
      const owner = target.kind === 'task' ? { task_id: target.id } : { event_id: target.id }
      const when =
        'remindAt' in v
          ? { remind_at: new Date(v.remindAt).toISOString() }
          : { offset_minutes: v.offsetMinutes }
      const row: TablesInsert<'reminders'> = { organization_id: orgId, ...owner, ...when }
      const { error } = await supabase.from('reminders').insert(row)
      if (error) throw error
    },
    onSuccess: done,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })

  return { create, remove }
}

// ----------------------------------------------------------- notificações
export function useNotifications(page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'list', page],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('notifications')
        .select('id, title, body, occurrence_at, read_at, created_at, task_id, event_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * NOTIFICATIONS_PAGE_SIZE, page * NOTIFICATIONS_PAGE_SIZE + NOTIFICATIONS_PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

/** Contador do sino: atualiza ao focar a janela e a cada minuto (mesma cadência do worker). */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useNotificationMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: done,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: done,
  })

  return { markRead, markAllRead }
}
