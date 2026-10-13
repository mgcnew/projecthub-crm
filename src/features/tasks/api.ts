import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { taskPayload, type TaskFormValues } from './schema'

export const PAGE_SIZE = 20

export type TaskListParams = {
  search: string
  status: 'open' | 'all' | 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: '' | 'low' | 'medium' | 'high' | 'urgent'
  projectId: string
  page: number
}

const nameOf = (rel: unknown) => (rel as { name: string } | null)?.name

export function useTasks(params: TaskListParams, enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'list', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, due_at, project_id, parent_task_id, projects(name)', {
          count: 'exact',
        })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(params.page * PAGE_SIZE, params.page * PAGE_SIZE + PAGE_SIZE - 1)
      const term = sanitizeSearch(params.search)
      if (term) q = q.ilike('title', `%${term}%`)
      if (params.status === 'open') q = q.in('status', ['todo', 'in_progress'])
      else if (params.status !== 'all') q = q.eq('status', params.status)
      if (params.priority) q = q.eq('priority', params.priority)
      if (params.projectId) q = q.eq('project_id', params.projectId)
      const { data, error, count } = await q
      if (error) throw error
      return {
        count: count ?? 0,
        rows: (data ?? []).map((t) => ({ ...t, projectName: nameOf(t.projects) })),
      }
    },
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSubtasks(parentId: string) {
  return useQuery({
    queryKey: ['tasks', 'children', parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('parent_task_id', parentId)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Escopo de vínculo: um projeto, ou um cliente (tarefas ligadas ao cliente OU a qualquer projeto dele).
 * `projectIds` precisa estar carregado para o escopo de cliente enxergar o que passa pelos projetos.
 */
export type LinkScope = { projectId: string } | { clientId: string; projectIds: string[] }

/** Filtro PostgREST (`or`) para um escopo de cliente; UUIDs são seguros dentro de `or()`. */
export function clientScopeFilter(clientId: string, projectIds: string[]) {
  return projectIds.length
    ? `client_id.eq.${clientId},project_id.in.(${projectIds.join(',')})`
    : `client_id.eq.${clientId}`
}

/** Tarefas abertas do projeto/cliente (as 10 de prazo mais próximo) e o total de abertas. */
export function useLinkedTasks(scope: LinkScope, enabled = true) {
  return useQuery({
    queryKey: ['tasks', 'linked', scope],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, due_at', { count: 'exact' })
        .in('status', ['todo', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(10)
      q = 'projectId' in scope ? q.eq('project_id', scope.projectId) : q.or(clientScopeFilter(scope.clientId, scope.projectIds))
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

/** Tarefas abertas para seletores (ex.: planejar no Meu dia). */
export function useOpenTaskOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'options'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title')
        .in('status', ['todo', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
  })
}

type QuickCreate = { title: string; parentTaskId?: string; projectId?: string | null; clientId?: string | null }

export function useQuickCreateTask(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, parentTaskId, projectId, clientId }: QuickCreate) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          organization_id: orgId,
          title: title.trim(),
          parent_task_id: parentTaskId ?? null,
          project_id: projectId ?? null,
          client_id: clientId ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const { error } = await supabase.from('tasks').update(taskPayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useSetTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'todo' | 'done' | 'cancelled' | 'in_progress' }) => {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}

// ------------------------------------------------------------ checklist
export function useChecklist(taskId: string) {
  return useQuery({
    queryKey: ['checklist', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('id, title, is_completed, sort_order')
        .eq('task_id', taskId)
        .order('sort_order')
        .order('title')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useChecklistMutations(orgId: string | undefined, taskId: string) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['checklist', taskId] })
  const add = useMutation({
    mutationFn: async ({ title, sortOrder }: { title: string; sortOrder: number }) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase
        .from('checklist_items')
        .insert({ organization_id: orgId, task_id: taskId, title: title.trim(), sort_order: sortOrder })
      if (error) throw error
    },
    onSuccess: done,
  })
  const toggle = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('checklist_items').update({ is_completed: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
  return { add, toggle, remove }
}

// ------------------------------------------------------------- templates
export function useChecklistTemplates(enabled = true) {
  return useQuery({
    queryKey: ['checklist-templates'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, name, description, category, checklist_template_items(id, title, sort_order)')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateTemplate(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { name: string; category: string; items: string[] }) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('checklist_templates')
        .insert({ organization_id: orgId, name: v.name.trim(), category: v.category.trim() || null })
        .select('id')
        .single()
      if (error) throw error
      if (v.items.length > 0) {
        const { error: e2 } = await supabase.from('checklist_template_items').insert(
          v.items.map((title, i) => ({
            organization_id: orgId,
            template_id: data.id,
            title,
            sort_order: i,
          })),
        )
        if (e2) throw e2
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-templates'] }),
  })
}

/** Copia os itens do modelo em um único insert: o checklist da tarefa passa a ser independente (D034). */
export function useApplyTemplate(orgId: string | undefined, taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, startOrder }: { templateId: string; startOrder: number }) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('checklist_template_items')
        .select('title, sort_order')
        .eq('template_id', templateId)
        .order('sort_order')
      if (error) throw error
      if (!data || data.length === 0) return 0
      const { error: e2 } = await supabase.from('checklist_items').insert(
        data.map((it, i) => ({
          organization_id: orgId,
          task_id: taskId,
          title: it.title,
          sort_order: startOrder + i,
        })),
      )
      if (e2) throw e2
      return data.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist', taskId] }),
  })
}

// ------------------------------------------------------------ planejamento
export function useTaskPlans(taskId: string) {
  return useQuery({
    queryKey: ['plans', 'task', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_plans')
        .select('id, planned_date, status')
        .eq('task_id', taskId)
        .eq('status', 'planned')
        .order('planned_date')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDayPlans(date: string, enabled: boolean) {
  return useQuery({
    queryKey: ['plans', 'day', date],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_plans')
        .select('id, sort_order, status, task_id, tasks(id, title, status, priority, due_date, due_at, projects(name))')
        .eq('planned_date', date)
        .neq('status', 'cancelled')
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

export function usePlanMutations(orgId: string | undefined) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['plans'] })
  const add = useMutation({
    mutationFn: async ({ taskId, date, sortOrder = 0 }: { taskId: string; date: string; sortOrder?: number }) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase
        .from('task_plans')
        .insert({ organization_id: orgId, task_id: taskId, planned_date: date, sort_order: sortOrder })
      if (error) throw error
    },
    onSuccess: done,
  })
  const move = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase.from('task_plans').update({ planned_date: date }).eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
  return { add, move, remove }
}
