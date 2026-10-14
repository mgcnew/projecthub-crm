import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  documentPayload,
  interactionPayload,
  type DocumentFormValues,
  type InteractionFormValues,
  type NextContactValues,
} from './schema'

export type InteractionRow = {
  id: string
  kind: string
  occurred_at: string
  summary: string
  contact_id: string | null
  client_contacts: { name: string } | null
}

export type DocumentRow = {
  id: string
  title: string
  url: string
  kind: string
  notes: string | null
  project_id: string | null
  projects: { name: string } | null
}

export function useInteractions(clientId: string) {
  return useQuery({
    queryKey: ['client-interactions', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_interactions')
        .select('id, kind, occurred_at, summary, contact_id, client_contacts(name)')
        .eq('client_id', clientId)
        .order('occurred_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as InteractionRow[]
    },
  })
}

export function useSaveInteraction(orgId: string | undefined, clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: InteractionFormValues }) => {
      if (id) {
        const { error } = await supabase.from('client_interactions').update(interactionPayload(values)).eq('id', id)
        if (error) throw error
        return
      }
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase
        .from('client_interactions')
        .insert({ organization_id: orgId, client_id: clientId, ...interactionPayload(values) })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-interactions', clientId] }),
  })
}

export function useDeleteInteraction(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_interactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-interactions', clientId] }),
  })
}

export function useDocuments(clientId: string) {
  return useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_documents')
        .select('id, title, url, kind, notes, project_id, projects(name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DocumentRow[]
    },
  })
}

export function useSaveDocument(orgId: string | undefined, clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: DocumentFormValues }) => {
      if (id) {
        const { error } = await supabase.from('client_documents').update(documentPayload(values)).eq('id', id)
        if (error) throw error
        return
      }
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase
        .from('client_documents')
        .insert({ organization_id: orgId, client_id: clientId, ...documentPayload(values) })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-documents', clientId] }),
  })
}

export function useDeleteDocument(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-documents', clientId] }),
  })
}

export function useSaveNextContact(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: NextContactValues) => {
      const { error } = await supabase
        .from('clients')
        .update({
          next_contact_on: v.next_contact_on === '' ? null : v.next_contact_on,
          next_contact_note: v.next_contact_note.trim() === '' ? null : v.next_contact_note.trim(),
        })
        .eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['follow-ups'] })
    },
  })
}

/** Clientes com próximo contato vencido ou até `endDate` (Central do dia). */
export function useFollowUps(endDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['follow-ups', endDate],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, next_contact_on, next_contact_note')
        .is('archived_at', null)
        .not('next_contact_on', 'is', null)
        .lte('next_contact_on', endDate)
        .order('next_contact_on')
        .limit(8)
      if (error) throw error
      return data ?? []
    },
  })
}
