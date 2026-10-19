import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { leadErrorMessage } from '../schema'
import type { ExistingLead, ImportPlan, LineIssue } from './plan'

const existingColumns =
  'id, company_name, contact_name, email, phone, website, address_line, city, state, segment, notes'
const CHUNK = 200

function chunks<T>(list: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Leads já cadastrados que batem por e-mail ou telefone com a planilha (em lotes, sob a RLS). */
export async function fetchExisting(emails: string[], phones: string[]): Promise<ExistingLead[]> {
  const found = new Map<string, ExistingLead>()
  for (const part of chunks([...new Set(emails)], CHUNK)) {
    const { data, error } = await supabase.from('leads').select(existingColumns).in('email', part)
    if (error) throw error
    for (const r of data ?? []) found.set(r.id, r as ExistingLead)
  }
  for (const part of chunks([...new Set(phones)], CHUNK)) {
    const { data, error } = await supabase.from('leads').select(existingColumns).in('phone', part)
    if (error) throw error
    for (const r of data ?? []) found.set(r.id, r as ExistingLead)
  }
  return [...found.values()]
}

export type ImportResult = { created: number; updated: number; skipped: number; errors: LineIssue[] }

export function useRunImport(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { plan: ImportPlan; source: string; fileName: string; total: number }): Promise<ImportResult> => {
      if (!orgId) throw new Error('Organização não carregada')
      const { plan, source, fileName, total } = input
      const errors: LineIssue[] = [...plan.errors]
      let created = 0
      let updated = 0

      for (const part of chunks(plan.inserts, CHUNK)) {
        const rows = part.map(({ line: _line, ...lead }) => {
          void _line
          return { organization_id: orgId, source, ...lead }
        })
        const { error } = await supabase.from('leads').insert(rows)
        if (error) {
          // Lote recusado (ex.: duplicado criado ao mesmo tempo): registra cada linha com o motivo.
          const reason = leadErrorMessage(error)
          for (const l of part) errors.push({ line: l.line, reason })
        } else {
          created += part.length
        }
      }

      for (const u of plan.updates) {
        const { error } = await supabase.from('leads').update(u.patch).eq('id', u.id)
        if (error) errors.push({ line: u.line, reason: leadErrorMessage(error) })
        else updated += 1
      }

      errors.sort((a, b) => a.line - b.line)
      const skipped = plan.skipped.length
      await supabase.from('lead_imports').insert({
        organization_id: orgId,
        file_name: fileName.slice(0, 255),
        source,
        total,
        created,
        updated,
        skipped,
        errors: errors.slice(0, 200),
      })
      return { created, updated, skipped, errors }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] })
      void qc.invalidateQueries({ queryKey: ['lead-imports'] })
    },
  })
}

export function useLeadImports(enabled: boolean) {
  return useQuery({
    queryKey: ['lead-imports'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_imports')
        .select('id, file_name, source, total, created, updated, skipped, errors, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })
}
