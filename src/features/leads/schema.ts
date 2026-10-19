import { z } from 'zod'
import { emptyToNull } from '@/lib/format'
import { normalizePhone } from '@/lib/phone'

export const temperatures = { cold: 'Frio', warm: 'Morno', hot: 'Quente' } as const
export const stages = {
  new: 'Novo',
  contacted: 'Contatado',
  replied: 'Respondeu',
  meeting: 'Reunião',
  proposal: 'Proposta',
  won: 'Ganho',
  lost: 'Perdido',
} as const

export type Temperature = keyof typeof temperatures
export type Stage = keyof typeof stages

const isoDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')])

export const leadFormSchema = z.object({
  company_name: z.string().trim().min(1, 'Informe a empresa').max(200, 'Máximo de 200 caracteres'),
  contact_name: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  email: z.union([z.literal(''), z.email('E-mail inválido')]),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || normalizePhone(v) !== null, 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678'),
  website: z
    .string()
    .trim()
    .max(2048, 'Máximo de 2.048 caracteres')
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Use um endereço que comece com http:// ou https://'),
  address_line: z.string().trim().max(300, 'Máximo de 300 caracteres'),
  city: z.string().trim().max(100, 'Máximo de 100 caracteres'),
  state: z.string().trim().max(60, 'Máximo de 60 caracteres'),
  segment: z.string().trim().max(100, 'Máximo de 100 caracteres'),
  source: z.string().trim().min(1, 'Informe a origem (de onde veio o contato)').max(200, 'Máximo de 200 caracteres'),
  temperature: z.enum(['cold', 'warm', 'hot']),
  stage: z.enum(['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost']),
  lost_reason: z.string().trim().max(300, 'Máximo de 300 caracteres'),
  hook: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  notes: z.string().max(5000, 'Máximo de 5.000 caracteres'),
  next_contact_on: isoDate,
})

export type LeadFormValues = z.infer<typeof leadFormSchema>

export const leadDefaults: LeadFormValues = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  address_line: '',
  city: '',
  state: '',
  segment: '',
  source: '',
  temperature: 'cold',
  stage: 'new',
  lost_reason: '',
  hook: '',
  notes: '',
  next_contact_on: '',
}

export function leadPayload(v: LeadFormValues) {
  return {
    company_name: v.company_name.trim(),
    contact_name: emptyToNull(v.contact_name),
    email: emptyToNull(v.email.toLowerCase()),
    phone: v.phone.trim() === '' ? null : normalizePhone(v.phone),
    website: emptyToNull(v.website),
    address_line: emptyToNull(v.address_line),
    city: emptyToNull(v.city),
    state: emptyToNull(v.state),
    segment: emptyToNull(v.segment),
    source: v.source.trim(),
    temperature: v.temperature,
    stage: v.stage,
    // Motivo só faz sentido em "Perdido": em outra etapa é limpo.
    lost_reason: v.stage === 'lost' ? emptyToNull(v.lost_reason) : null,
    hook: emptyToNull(v.hook),
    notes: emptyToNull(v.notes),
    next_contact_on: v.next_contact_on === '' ? null : v.next_contact_on,
  }
}

/** Erro do banco → mensagem clara (duplicado por e-mail ou telefone). */
export function leadErrorMessage(error: unknown) {
  const e = error as { code?: string; message?: string } | null
  if (e?.code === '23505') {
    if (e.message?.includes('leads_org_email_key')) return 'Já existe um lead com este e-mail.'
    if (e.message?.includes('leads_org_phone_key')) return 'Já existe um lead com este telefone.'
    return 'Já existe um lead com estes dados.'
  }
  return 'Não foi possível salvar o lead. Tente novamente.'
}
