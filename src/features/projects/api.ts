import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { projectPayload, type LogValues, type ProjectFormValues } from './schema'

export const PAGE_SIZE = 20
export type ArchivedFilter = 'active' | 'archived' | 'all'

export type ProjectListParams = {
  search: string
  status: '' | 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  clientId: string
  archived: ArchivedFilter
  page: number
}

export function useProjects(params: ProjectListParams, enabled: boolean) {
  return useQuery({
    queryKey: ['projects', 'list', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from('projects')
        .select('id, name, status, priority, target_date, archived_at, client_id, clients(name)', { count: 'exact' })
        .order('target_date', { ascending: true, nullsFirst: false })
        .order('name')
        .range(params.page * PAGE_SIZE, params.page * PAGE_SIZE + PAGE_SIZE - 1)
      const term = sanitizeSearch(params.search)
      if (term) q = q.ilike('name', `%${term}%`)
      if (params.status) q = q.eq('status', params.status)
      if (params.clientId) q = q.eq('client_id', params.clientId)
      if (params.archived === 'active') q = q.is('archived_at', null)
      if (params.archived === 'archived') q = q.not('archived_at', 'is', null)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useProjectsByClient(clientId: string) {
  return useQuery({
    queryKey: ['projects', 'by-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('client_id', clientId)
        .is('archived_at', null)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateProject(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('projects')
        .insert({ organization_id: orgId, ...projectPayload(values) })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const { error } = await supabase.from('projects').update(projectPayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useArchiveProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase
        .from('projects')
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useProjectLogs(projectId: string) {
  return useQuery({
    queryKey: ['project-logs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_logs')
        .select('id, title, content, created_at, author_id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAddProjectLog(orgId: string | undefined, projectId: string, authorId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: LogValues) => {
      if (!orgId || !authorId) throw new Error('Sessão não carregada')
      const { error } = await supabase.from('project_logs').insert({
        organization_id: orgId,
        project_id: projectId,
        author_id: authorId,
        title: values.title.trim(),
        content: values.content,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-logs', projectId] }),
  })
}
