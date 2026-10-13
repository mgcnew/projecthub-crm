import { z } from 'zod'
import { emptyToNull } from '@/lib/format'

/** Sugestões de categoria (texto livre; o banco aceita qualquer valor de até 60 caracteres). */
export const accessCategories = [
  'E-mail',
  'Hospedagem',
  'Repositório',
  'Banco de dados',
  'Domínio',
  'Pagamentos',
  'Ferramenta',
  'Outro',
] as const

/** Só http(s): a URL vira link; `javascript:` e afins nunca são aceitos (o banco também confere). */
export const isHttpUrl = (v: string) => /^https?:\/\/[^\s]+$/i.test(v)

export const accessFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do serviço').max(200, 'Máximo de 200 caracteres'),
  category: z.string().trim().max(60, 'Máximo de 60 caracteres'),
  url: z
    .string()
    .trim()
    .max(2048, 'Máximo de 2.048 caracteres')
    .refine((v) => v === '' || isHttpUrl(v), 'Use um endereço que comece com http:// ou https://'),
  username: z.string().trim().max(320, 'Máximo de 320 caracteres'),
  manager_item: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  project_id: z.string(),
  client_id: z.string(),
  notes: z.string().max(5000, 'Máximo de 5.000 caracteres'),
})

export type AccessFormValues = z.infer<typeof accessFormSchema>

export const accessDefaults: AccessFormValues = {
  name: '',
  category: '',
  url: '',
  username: '',
  manager_item: '',
  project_id: '',
  client_id: '',
  notes: '',
}

export function accessPayload(v: AccessFormValues) {
  return {
    name: v.name.trim(),
    category: emptyToNull(v.category),
    url: emptyToNull(v.url),
    username: emptyToNull(v.username),
    manager_item: emptyToNull(v.manager_item),
    project_id: emptyToNull(v.project_id),
    client_id: emptyToNull(v.client_id),
    notes: emptyToNull(v.notes),
  }
}
