import { z } from 'zod'
import { formatTaxId, isValidTaxId } from '@/lib/documents'
import { emptyToNull } from '@/lib/format'

export const clientStatuses = { active: 'Ativo', inactive: 'Inativo' } as const

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(200, 'Máximo de 200 caracteres'),
  company_name: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  email: z.union([z.literal(''), z.email('E-mail inválido')]),
  phone: z.string().trim().max(40, 'Máximo de 40 caracteres'),
  status: z.enum(['active', 'inactive']),
  notes: z.string().max(10000, 'Máximo de 10.000 caracteres'),
  legal_name: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  tax_id: z
    .string()
    .trim()
    .max(20, 'Máximo de 20 caracteres')
    .refine((v) => v === '' || isValidTaxId(v), 'CPF ou CNPJ inválido. Confira os dígitos.'),
  billing_email: z.union([z.literal(''), z.email('E-mail inválido')]),
  website: z
    .string()
    .trim()
    .max(2048, 'Máximo de 2.048 caracteres')
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Use um endereço que comece com http:// ou https://'),
  address_line: z.string().trim().max(300, 'Máximo de 300 caracteres'),
  address_city: z.string().trim().max(100, 'Máximo de 100 caracteres'),
  address_state: z.string().trim().max(60, 'Máximo de 60 caracteres'),
  address_postal_code: z.string().trim().max(20, 'Máximo de 20 caracteres'),
  source: z.string().trim().max(100, 'Máximo de 100 caracteres'),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

export const clientDefaults: ClientFormValues = {
  name: '',
  company_name: '',
  email: '',
  phone: '',
  status: 'active',
  notes: '',
  legal_name: '',
  tax_id: '',
  billing_email: '',
  website: '',
  address_line: '',
  address_city: '',
  address_state: '',
  address_postal_code: '',
  source: '',
}

export function clientPayload(v: ClientFormValues) {
  return {
    name: v.name.trim(),
    company_name: emptyToNull(v.company_name),
    email: emptyToNull(v.email),
    phone: emptyToNull(v.phone),
    status: v.status,
    notes: emptyToNull(v.notes),
    legal_name: emptyToNull(v.legal_name),
    tax_id: v.tax_id.trim() === '' ? null : formatTaxId(v.tax_id),
    billing_email: emptyToNull(v.billing_email),
    website: emptyToNull(v.website),
    address_line: emptyToNull(v.address_line),
    address_city: emptyToNull(v.address_city),
    address_state: emptyToNull(v.address_state),
    address_postal_code: emptyToNull(v.address_postal_code),
    source: emptyToNull(v.source),
  }
}
