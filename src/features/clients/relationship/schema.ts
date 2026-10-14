import { z } from 'zod'
import { emptyToNull, fromLocalInput } from '@/lib/format'

export const interactionKinds = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  message: 'Mensagem',
  note: 'Anotação',
} as const

export const documentKinds = {
  contract: 'Contrato',
  proposal: 'Proposta',
  briefing: 'Briefing',
  invoice: 'Nota fiscal',
  other: 'Outro',
} as const

export const interactionFormSchema = z.object({
  kind: z.enum(['call', 'email', 'meeting', 'message', 'note']),
  occurred_at: z.string().min(1, 'Informe quando foi'),
  contact_id: z.string(),
  summary: z.string().trim().min(1, 'Descreva em poucas palavras').max(5000, 'Máximo de 5.000 caracteres'),
})
export type InteractionFormValues = z.infer<typeof interactionFormSchema>

export function interactionPayload(v: InteractionFormValues) {
  return {
    kind: v.kind,
    occurred_at: fromLocalInput(v.occurred_at) ?? new Date().toISOString(),
    contact_id: emptyToNull(v.contact_id),
    summary: v.summary.trim(),
  }
}

export const documentFormSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(200, 'Máximo de 200 caracteres'),
  url: z
    .string()
    .trim()
    .min(1, 'Informe o endereço do documento')
    .max(2048, 'Máximo de 2.048 caracteres')
    .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), 'Use um endereço que comece com http:// ou https://'),
  kind: z.enum(['contract', 'proposal', 'briefing', 'invoice', 'other']),
  project_id: z.string(),
  notes: z.string().max(1000, 'Máximo de 1.000 caracteres'),
})
export type DocumentFormValues = z.infer<typeof documentFormSchema>

export const documentDefaults: DocumentFormValues = { title: '', url: '', kind: 'other', project_id: '', notes: '' }

export function documentPayload(v: DocumentFormValues) {
  return {
    title: v.title.trim(),
    url: v.url.trim(),
    kind: v.kind,
    project_id: emptyToNull(v.project_id),
    notes: emptyToNull(v.notes),
  }
}

export const nextContactSchema = z.object({
  next_contact_on: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')]),
  next_contact_note: z.string().trim().max(200, 'Máximo de 200 caracteres'),
})
export type NextContactValues = z.infer<typeof nextContactSchema>
