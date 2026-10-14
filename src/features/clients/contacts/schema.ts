import { z } from 'zod'
import { emptyToNull } from '@/lib/format'

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(200, 'Máximo de 200 caracteres'),
  role_title: z.string().trim().max(100, 'Máximo de 100 caracteres'),
  email: z.union([z.literal(''), z.email('E-mail inválido')]),
  phone: z.string().trim().max(40, 'Máximo de 40 caracteres'),
  whatsapp: z.string().trim().max(40, 'Máximo de 40 caracteres'),
  is_primary: z.boolean(),
  notes: z.string().max(2000, 'Máximo de 2.000 caracteres'),
})
export type ContactFormValues = z.infer<typeof contactFormSchema>

export const contactDefaults: ContactFormValues = {
  name: '',
  role_title: '',
  email: '',
  phone: '',
  whatsapp: '',
  is_primary: false,
  notes: '',
}

export function contactPayload(v: ContactFormValues) {
  return {
    name: v.name.trim(),
    role_title: emptyToNull(v.role_title),
    email: emptyToNull(v.email),
    phone: emptyToNull(v.phone),
    whatsapp: emptyToNull(v.whatsapp),
    is_primary: v.is_primary,
    notes: emptyToNull(v.notes),
  }
}
