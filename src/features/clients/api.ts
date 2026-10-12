import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { clientPayload, type ClientFormValues } from './schema'

export const PAGE_SIZE = 20
export type ArchivedFilter = 'active' | 'archived' | 'all'

export type ClientListParams = {
  search: string
  status: '' | 'active' | 'inactive'
  archived: ArchivedFilter
  page: number
}

export function useClients(params: ClientListParams, enabled: boolean) {
  return useQuery({
    queryKey: ['clients', 'list', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from('clients')
        .select('id, name, company_name, email, phone, status, archived_at', { count: 'exact' })
        .order('name')
        .range(params.page * PAGE_SIZE, params.page * PAGE_SIZE + PAGE_SIZE - 1)
      const term = sanitizeSearch(params.search)
      if (term) q = q.or(`name.ilike.%${term}%,company_name.ilike.%${term}%`)
      if (params.status) q = q.eq('status', params.status)
      if (params.archived === 'active') q = q.is('archived_at', null)
      if (params.archived === 'archived') q = q.not('archived_at', 'is', null)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Clientes não arquivados para seletores. */
export function useClientOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['clients', 'options'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .is('archived_at', null)
        .order('name')
        .limit(500)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateClient(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ClientFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('clients')
        .insert({ organization_id: orgId, ...clientPayload(values) })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const { error } = await supabase.from('clients').update(clientPayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useArchiveClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase
        .from('clients')
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
