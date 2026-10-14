import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { contactPayload, type ContactFormValues } from './schema'

export type ContactRow = {
  id: string
  name: string
  role_title: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  is_primary: boolean
  notes: string | null
}

export function useClientContacts(clientId: string) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('id, name, role_title, email, phone, whatsapp, is_primary, notes')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('name')
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
  })
}

export function useSaveContact(orgId: string | undefined, clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ContactFormValues }) => {
      if (id) {
        const { error } = await supabase.from('client_contacts').update(contactPayload(values)).eq('id', id)
        if (error) throw error
        return
      }
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase
        .from('client_contacts')
        .insert({ organization_id: orgId, client_id: clientId, ...contactPayload(values) })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-contacts', clientId] }),
  })
}

export function useDeleteContact(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-contacts', clientId] }),
  })
}
