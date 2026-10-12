import { z } from 'zod'
import { emptyToNull } from '@/lib/format'

export const clientStatuses = { active: 'Ativo', inactive: 'Inativo' } as const

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(200, 'Máximo de 200 caracteres'),
  company_name: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  email: z.union([z.literal(''), z.email('E-mail inválido')]),
  phone: z.string().trim().max(40, 'Máximo de 40 caracteres'),
  status: z.enum(['active', 'inactive']),
  notes: z.string().max(10000, 'Máximo de 10.000 caracteres'),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

export const clientDefaults: ClientFormValues = {
  name: '',
  company_name: '',
  email: '',
  phone: '',
  status: 'active',
  notes: '',
}

export function clientPayload(v: ClientFormValues) {
  return {
    name: v.name.trim(),
    company_name: emptyToNull(v.company_name),
    email: emptyToNull(v.email),
    phone: emptyToNull(v.phone),
    status: v.status,
    notes: emptyToNull(v.notes),
  }
}
