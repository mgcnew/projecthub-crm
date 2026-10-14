import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PlannedPayment } from './schedule'
import { paymentPayload, type PaymentFormValues } from './schema'

const columns = 'id, project_id, kind, description, amount_cents, due_date, status, paid_on, payment_method, invoice_number, notes'

export type PaymentRow = {
  id: string
  project_id: string
  kind: string
  description: string | null
  amount_cents: number
  due_date: string
  status: string
  paid_on: string | null
  payment_method: string | null
  invoice_number: string | null
  notes: string | null
}

export function useProjectPayments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['finance', 'project', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments')
        .select(columns)
        .eq('project_id', projectId!)
        .order('due_date')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as PaymentRow[]
    },
  })
}

/** Projetos do cliente (com valor e moeda) e todas as parcelas deles. */
export function useClientFinance(clientId: string | undefined) {
  return useQuery({
    queryKey: ['finance', 'client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const projects = await supabase
        .from('projects')
        .select('id, name, currency, contract_value_cents, archived_at')
        .eq('client_id', clientId!)
        .order('name')
      if (projects.error) throw projects.error
      const list = projects.data ?? []
      if (list.length === 0) return { projects: list, payments: [] as PaymentRow[] }
      const pay = await supabase
        .from('project_payments')
        .select(columns)
        .in('project_id', list.map((p) => p.id))
        .order('due_date')
      if (pay.error) throw pay.error
      return { projects: list, payments: (pay.data ?? []) as PaymentRow[] }
    },
  })
}

/** A receber vencido ou vencendo até `endDate` (Central do dia). */
export function useReceivables(endDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['finance', 'receivables', endDate],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments')
        .select('id, project_id, kind, description, amount_cents, due_date, projects(name, currency, clients(name))')
        .eq('status', 'pending')
        .lte('due_date', endDate)
        .order('due_date')
        .limit(12)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreatePayments(orgId: string | undefined, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: PlannedPayment[]) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase.from('project_payments').insert(
        rows.map((r) => ({
          organization_id: orgId,
          project_id: projectId,
          kind: r.kind,
          description: r.description,
          amount_cents: r.amount_cents,
          due_date: r.due_date,
        })),
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

export function useCreatePayment(orgId: string | undefined, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      if (!orgId) throw new Error('Organização não carregada')
      const { error } = await supabase
        .from('project_payments')
        .insert({ organization_id: orgId, project_id: projectId, ...paymentPayload(values) })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

type PaymentPatch = Partial<{
  kind: string
  description: string | null
  amount_cents: number
  due_date: string
  status: string
  paid_on: string | null
  payment_method: string | null
  invoice_number: string | null
  notes: string | null
}>

export function useUpdatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PaymentPatch }) => {
      const { error } = await supabase.from('project_payments').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}

export function useDeletePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  })
}
