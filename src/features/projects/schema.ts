import { z } from 'zod'
import { emptyToNull } from '@/lib/format'

export const projectStatuses = {
  planning: 'Planejamento',
  active: 'Em andamento',
  on_hold: 'Em espera',
  completed: 'Concluído',
  cancelled: 'Cancelado',
} as const

export const projectPriorities = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' } as const

const isoDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')])

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome').max(200, 'Máximo de 200 caracteres'),
    description: z.string().max(10000, 'Máximo de 10.000 caracteres'),
    client_id: z.string(),
    status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    started_on: isoDate,
    target_date: isoDate,
  })
  .refine((v) => !v.started_on || !v.target_date || v.target_date >= v.started_on, {
    path: ['target_date'],
    message: 'O prazo não pode ser anterior ao início',
  })

export type ProjectFormValues = z.infer<typeof projectFormSchema>

export const projectDefaults: ProjectFormValues = {
  name: '',
  description: '',
  client_id: '',
  status: 'planning',
  priority: 'medium',
  started_on: '',
  target_date: '',
}

export function projectPayload(v: ProjectFormValues) {
  return {
    name: v.name.trim(),
    description: emptyToNull(v.description),
    client_id: emptyToNull(v.client_id),
    status: v.status,
    priority: v.priority,
    started_on: emptyToNull(v.started_on),
    target_date: emptyToNull(v.target_date),
  }
}

export const logSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(200, 'Máximo de 200 caracteres'),
  content: z.string().max(20000, 'Máximo de 20.000 caracteres'),
})
export type LogValues = z.infer<typeof logSchema>
