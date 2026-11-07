import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { accessPayload, type AccessFormValues } from './schema'

export type ArchivedFilter = 'active' | 'archived' | 'all'
export const ACCESS_LIMIT = 200
/** Valor do filtro de projeto para "acessos sem projeto" (`?projeto=sem`). */
export const NO_PROJECT = 'sem'

export type AccessListParams = {
  search: string
  archived: ArchivedFilter
  /** Id do projeto, ou `NO_PROJECT` para os acessos que não têm projeto. */
  projectId?: string
  category?: string
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
      if (params.projectId === NO_PROJECT) q = q.is('project_id', null)
      else if (params.projectId) q = q.eq('project_id', params.projectId)
      if (params.category) q = q.eq('category', params.category)
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

/** Projetos para o filtro: inclui os arquivados, porque um acesso pode continuar ligado a um deles. */
export function useAccessProjectOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['access', 'project-options'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, archived_at')
        .order('name')
        .limit(500)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Categorias que já existem nos acessos (texto livre), sem repetição e em ordem alfabética. */
export function useAccessCategories(enabled: boolean) {
  return useQuery({
    queryKey: ['access', 'categories'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('access_entries').select('category').not('category', 'is', null).limit(1000)
      if (error) throw error
      const names = (data ?? []).map((r) => r.category as string).filter(Boolean)
      return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    },
  })
}
