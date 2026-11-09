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
