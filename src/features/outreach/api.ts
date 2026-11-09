import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { productPayload, templatePayload, type Channel, type ProductFormValues, type TemplateFormValues } from './schema'

export type StatusFilter = 'active' | 'inactive' | 'all'

// ------------------------------------------------------------------ sistemas
export function useProducts(params: { search: string; status: StatusFilter }, enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'products', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase.from('products').select('id, name, value_proposition, audience, demo_url, price_note, active').order('name').limit(200)
      const term = sanitizeSearch(params.search)
      if (term) q = q.or(`name.ilike.%${term}%,value_proposition.ilike.%${term}%,audience.ilike.%${term}%`)
      if (params.status === 'active') q = q.eq('active', true)
      if (params.status === 'inactive') q = q.eq('active', false)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

/** Sistemas ativos para os seletores (modelo, lead, pré-visualização). */
export function useProductOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'product-options'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, value_proposition, demo_url, active').order('name').limit(200)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['outreach', 'product', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateProduct(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase.from('products').insert({ organization_id: orgId, ...productPayload(values) }).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const { error } = await supabase.from('products').update(productPayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

// ------------------------------------------------------------------- modelos
export type TemplateListParams = { channel: '' | Channel; step: '' | '1' | '2' | '3'; status: StatusFilter }

export function useTemplates(params: TemplateListParams, enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'templates', params],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from('message_templates')
        .select('id, name, channel, temperature, step, subject, body, active, product_id, products(name)')
        .order('step')
        .order('name')
        .limit(200)
      if (params.channel) q = q.eq('channel', params.channel)
      if (params.step) q = q.eq('step', Number(params.step))
      if (params.status === 'active') q = q.eq('active', true)
      if (params.status === 'inactive') q = q.eq('active', false)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['outreach', 'template', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('message_templates').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateTemplate(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { data, error } = await supabase.from('message_templates').insert({ organization_id: orgId, ...templatePayload(values) }).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      const { error } = await supabase.from('message_templates').update(templatePayload(values)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

/** Leads reais para a pré-visualização do modelo (os primeiros 50, por nome). */
export function useLeadSamples(enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'lead-samples'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, hook, product_id')
        .is('archived_at', null)
        .order('company_name')
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })
}

// ---------------------------------------------------------------------- fila
export type OutboxStatus = 'draft' | 'approved' | 'cancelled' | 'all'

export function useOutbox(status: OutboxStatus, enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'outbox', status],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from('outbound_messages')
        .select('id, lead_id, channel, to_address, subject, body, status, approved_at, template_id, created_at, leads(company_name), message_templates(name, step)')
        .order('created_at', { ascending: false })
        .limit(300)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useOutboxCounts(enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'outbox-counts'],
    enabled,
    queryFn: async () => {
      const count = async (status: string) => {
        const { count: n, error } = await supabase.from('outbound_messages').select('id', { count: 'exact', head: true }).eq('status', status)
        if (error) throw error
        return n ?? 0
      }
      const [draft, approved] = await Promise.all([count('draft'), count('approved')])
      return { draft, approved }
    },
  })
}

export function useOutboxMessage(id: string | undefined) {
  return useQuery({
    queryKey: ['outreach', 'outbox-message', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_messages')
        .select('*, leads(id, company_name, contact_name), message_templates(name, step)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type OutboxPatch = { subject?: string | null; body?: string; status?: 'draft' | 'approved' | 'cancelled' }

export function useUpdateOutbox(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: OutboxPatch) => {
      const { error } = await supabase.from('outbound_messages').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

/** Muda o status de várias mensagens, uma a uma: o banco confere cada uma (supressão, "não contatar"). */
export function useSetStatusMany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'approved' | 'cancelled' | 'draft' }) => {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const { error } = await supabase.from('outbound_messages').update({ status }).eq('id', id)
          if (error) throw error
        }),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { done: ids.length - failed, failed }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}

/** Leads candidatos a rascunho (não arquivados), com o necessário para checar a elegibilidade. */
export function useQueueLeads(enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'queue-leads'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, email, phone, hook, temperature, product_id, opted_out_at, archived_at')
        .is('archived_at', null)
        .order('company_name')
        .limit(1000)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSuppressedValues(enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'suppressed'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('suppression_list').select('value').limit(5000)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.value))
    },
  })
}

/** Leads que já têm o modelo em rascunho, aprovada ou enviando (o banco não aceita duplicar). */
export function useQueuedLeadIds(templateId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['outreach', 'queued', templateId],
    enabled: enabled && Boolean(templateId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_messages')
        .select('lead_id')
        .eq('template_id', templateId)
        .in('status', ['draft', 'approved', 'sending'])
        .limit(2000)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.lead_id))
    },
  })
}

export type DraftInput = { leadId: string; channel: Channel; subject: string | null; body: string }

/** Cria os rascunhos um a um (o banco recusa o que não pode); devolve quantos entraram e quantos foram barrados. */
export function useCreateDrafts(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, drafts }: { templateId: string; drafts: DraftInput[] }) => {
      if (!orgId) throw new Error('Organização não carregada')
      let created = 0
      let blocked = 0
      for (let i = 0; i < drafts.length; i += 8) {
        const chunk = drafts.slice(i, i + 8)
        const results = await Promise.allSettled(
          chunk.map(async (d) => {
            const { error } = await supabase.from('outbound_messages').insert({
              organization_id: orgId,
              lead_id: d.leadId,
              template_id: templateId,
              channel: d.channel,
              subject: d.subject,
              body: d.body,
            })
            if (error) throw error
          }),
        )
        for (const r of results) {
          if (r.status === 'fulfilled') created++
          else blocked++
        }
      }
      return { created, blocked }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['outreach'] }),
  })
}
