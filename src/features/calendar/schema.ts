import { z } from 'zod'
import { emptyToNull, fromLocalInput } from '@/lib/format'

export const eventTypes = { event: 'Evento', meeting: 'Reunião' } as const
export const eventStatuses = { scheduled: 'Agendado', completed: 'Concluído', cancelled: 'Cancelado' } as const
export const frequencies = { none: 'Não repete', daily: 'Diariamente', weekly: 'Semanalmente', monthly: 'Mensalmente' } as const
export const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe o título').max(300, 'Máximo de 300 caracteres'),
    description: z.string().max(20000, 'Máximo de 20.000 caracteres'),
    event_type: z.enum(['event', 'meeting']),
    project_id: z.string(),
    client_id: z.string(),
    start_at: z.string().min(1, 'Informe o início'),
    end_at: z.string().min(1, 'Informe o fim'),
    status: z.enum(['scheduled', 'completed', 'cancelled']),
    frequency: z.enum(['none', 'daily', 'weekly', 'monthly']),
    interval_value: z.string().regex(/^[1-9]\d{0,2}$/, 'Use um número de 1 a 365'),
    by_weekday: z.array(z.string()),
    ends_on: z.string(),
    occurrence_limit: z.string().regex(/^\d*$/, 'Use apenas números'),
  })
  .superRefine((v, ctx) => {
    if (v.start_at && v.end_at && new Date(v.end_at) <= new Date(v.start_at))
      ctx.addIssue({ code: 'custom', path: ['end_at'], message: 'O fim deve ser posterior ao início' })
    if (v.frequency !== 'none' && v.ends_on && v.start_at && v.ends_on < v.start_at.slice(0, 10))
      ctx.addIssue({ code: 'custom', path: ['ends_on'], message: 'O término não pode ser anterior ao início' })
    if (v.occurrence_limit && Number(v.occurrence_limit) < 1)
      ctx.addIssue({ code: 'custom', path: ['occurrence_limit'], message: 'Deve ser maior que zero' })
    if (v.frequency === 'weekly' && v.by_weekday.length > 0 && v.start_at) {
      const dow = String(new Date(v.start_at).getDay())
      if (!v.by_weekday.includes(dow))
        ctx.addIssue({ code: 'custom', path: ['by_weekday'], message: 'Inclua o dia da semana do primeiro evento' })
    }
  })

export type EventFormValues = z.infer<typeof eventFormSchema>

export function eventDefaults(startLocal = '', endLocal = ''): EventFormValues {
  return {
    title: '',
    description: '',
    event_type: 'event',
    project_id: '',
    client_id: '',
    start_at: startLocal,
    end_at: endLocal,
    status: 'scheduled',
    frequency: 'none',
    interval_value: '1',
    by_weekday: [],
    ends_on: '',
    occurrence_limit: '',
  }
}

export function eventPayload(v: EventFormValues) {
  return {
    title: v.title.trim(),
    description: emptyToNull(v.description),
    project_id: emptyToNull(v.project_id),
    client_id: emptyToNull(v.client_id),
    starts_at: fromLocalInput(v.start_at)!,
    ends_at: fromLocalInput(v.end_at)!,
    status: v.status,
  }
}

export function rulePayload(v: EventFormValues) {
  return {
    frequency: v.frequency as 'daily' | 'weekly' | 'monthly',
    interval_value: Number(v.interval_value),
    by_weekday: v.frequency === 'weekly' ? v.by_weekday.map(Number) : [],
    ends_on: emptyToNull(v.ends_on),
    occurrence_limit: v.occurrence_limit ? Number(v.occurrence_limit) : null,
  }
}

export const meetingFormSchema = z.object({
  agenda: z.string().max(20000, 'Máximo de 20.000 caracteres'),
  notes: z.string().max(50000, 'Máximo de 50.000 caracteres'),
  decisions: z.string().max(20000, 'Máximo de 20.000 caracteres'),
})
export type MeetingFormValues = z.infer<typeof meetingFormSchema>
