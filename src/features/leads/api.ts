import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { leadPayload, type LeadFormValues, type Stage, type Temperature } from './schema'

export const PAGE_SIZE = 20
export type ArchivedFilter = 'active' | 'archived' | 'all'

export type LeadListParams = {
  search: string
  temperature: '' | Temperature
  stage: '' | Stage
  archived: ArchivedFilter
  page: number
}

export function useLeads(params: LeadListParams, enabled: boolean) {
  return useQuery({
    queryKey: ['leads', 'list', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from('leads')
        .select(
          'id, company_name, contact_name, city, state, temperature, stage, next_contact_on, opted_out_at, archived_at',
          { count: 'exact' },
        )
        .order('company_name')
        .range(params.page * PAGE_SIZE, params.page * PAGE_SIZE + PAGE_SIZE - 1)
      const term = sanitizeSearch(params.search)
      if (term) {
        q = q.or(
          `company_name.ilike.%${term}%,contact_name.ilike.%${term}%,email.ilike.%${term}%,city.ilike.%${term}%,segment.ilike.%${term}%`,
        )
      }
      if (params.temperature) q = q.eq('temperature', params.temperature)
      if (params.stage) q = q.eq('stage', params.stage)
      if (params.archived === 'active') q = q.is('archived_at', null)
      if (params.archived === 'archived') q = q.not('archived_at', 'is', null)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['leads', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateLead(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: LeadFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase
        .from('leads')
        .insert({ organization_id: orgId, ...leadPayload(values) })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const { error } = await supabase.from('leads').update(leadPayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useArchiveLead(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase
        .from('leads')
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

/**
 * "Não contatar": marcar suprime e-mail e telefone em todos os canais (trigger no banco). Reativar limpa a
 * marca e desfaz só as supressões manuais desses endereços; saídas pedidas pelo próprio lead continuam.
 */
export function useSetOptOut(lead: { id: string; email: string | null; phone: string | null }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (optOut: boolean) => {
      const { error } = await supabase
        .from('leads')
        .update({ opted_out_at: optOut ? new Date().toISOString() : null })
        .eq('id', lead.id)
      if (error) throw error
      if (!optOut) {
        const values = [lead.email, lead.phone].filter((v): v is string => Boolean(v))
        if (values.length > 0) {
          const del = await supabase.from('suppression_list').delete().eq('reason', 'manual').in('value', values)
          if (del.error) throw del.error
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] })
      void qc.invalidateQueries({ queryKey: ['suppression'] })
    },
  })
}

/** O lead está suprimido por algum endereço dele (inclusive saídas pedidas pelo próprio lead)? */
export function useLeadSuppression(lead: { email: string | null; phone: string | null } | null | undefined) {
  const values = [lead?.email, lead?.phone].filter((v): v is string => Boolean(v))
  return useQuery({
    queryKey: ['suppression', values],
    enabled: values.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('suppression_list').select('channel, value, reason').in('value', values)
      if (error) throw error
      return data ?? []
    },
  })
}
