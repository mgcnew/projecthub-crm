import { z } from 'zod'
import { emptyToNull, fromLocalInput } from '@/lib/format'

export const taskStatuses = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
} as const

export const taskPriorities = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' } as const

export const deadlineTypes = { none: 'Sem prazo', date: 'Dia inteiro', datetime: 'Data e hora' } as const

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe o título').max(300, 'Máximo de 300 caracteres'),
    description: z.string().max(20000, 'Máximo de 20.000 caracteres'),
    project_id: z.string(),
    client_id: z.string(),
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    deadline_type: z.enum(['none', 'date', 'datetime']),
    due_date: z.string(),
    due_at: z.string(),
    estimated_minutes: z.string().regex(/^\d*$/, 'Use apenas números'),
  })
  .superRefine((v, ctx) => {
    if (v.deadline_type === 'date' && !v.due_date)
      ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'Informe a data' })
    if (v.deadline_type === 'datetime' && !v.due_at)
      ctx.addIssue({ code: 'custom', path: ['due_at'], message: 'Informe data e hora' })
    if (v.estimated_minutes && Number(v.estimated_minutes) <= 0)
      ctx.addIssue({ code: 'custom', path: ['estimated_minutes'], message: 'Deve ser maior que zero' })
  })

export type TaskFormValues = z.infer<typeof taskFormSchema>

export const taskDefaults: TaskFormValues = {
  title: '',
  description: '',
  project_id: '',
  client_id: '',
  status: 'todo',
  priority: 'medium',
  deadline_type: 'none',
  due_date: '',
  due_at: '',
  estimated_minutes: '',
}

/** Prazo é exclusivo: só um entre due_date e due_at é enviado (D032). */
export function taskPayload(v: TaskFormValues) {
  return {
    title: v.title.trim(),
    description: emptyToNull(v.description),
    project_id: emptyToNull(v.project_id),
    client_id: emptyToNull(v.client_id),
    status: v.status,
    priority: v.priority,
    due_date: v.deadline_type === 'date' ? emptyToNull(v.due_date) : null,
    due_at: v.deadline_type === 'datetime' ? fromLocalInput(v.due_at) : null,
    estimated_minutes: v.estimated_minutes ? Number(v.estimated_minutes) : null,
  }
}

export const simpleTitleSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(300, 'Máximo de 300 caracteres'),
})
