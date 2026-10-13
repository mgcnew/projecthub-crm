import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { accessPayload, type AccessFormValues } from './schema'

export type ArchivedFilter = 'active' | 'archived' | 'all'
export const ACCESS_LIMIT = 200

export type AccessListParams = {
  search: string
  archived: ArchivedFilter
  projectId?: string
  /** Cliente: acessos ligados a ele ou a qualquer projeto dele (`projectIds`). */
  clientId?: string
  projectIds?: string[]
}

const columns = 'id, name, category, url, username, manager_item, notes, project_id, client_id, archived_at, projects(name), clients(name)'

export function useAccessEntries(params: AccessListParams, enabled: boolean) {
  return useQuery({
    queryKey: ['access', 'list', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase.from('access_entries').select(columns, { count: 'exact' }).order('name').limit(ACCESS_LIMIT)
      const term = sanitizeSearch(params.search)
      if (term) q = q.or(`name.ilike.%${term}%,username.ilike.%${term}%,category.ilike.%${term}%`)
      if (params.projectId) q = q.eq('project_id', params.projectId)
      if (params.clientId) {
        const ids = (params.projectIds ?? []).filter((v) => /^[0-9a-f-]{36}$/i.test(v))
        q = ids.length
          ? q.or(`client_id.eq.${params.clientId},project_id.in.(${ids.join(',')})`)
          : q.eq('client_id', params.clientId)
      }
      if (params.archived === 'active') q = q.is('archived_at', null)
      if (params.archived === 'archived') q = q.not('archived_at', 'is', null)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

export function useAccessEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['access', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('access_entries').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateAccess(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: AccessFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('access_entries')
        .insert({ organization_id: orgId, ...accessPayload(values) })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access'] }),
  })
}

export function useUpdateAccess(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: AccessFormValues) => {
      const { error } = await supabase.from('access_entries').update(accessPayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access'] }),
  })
}

export function useArchiveAccess(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase
        .from('access_entries')
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access'] }),
  })
}

export function useDeleteAccess(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('access_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access'] }),
  })
}
