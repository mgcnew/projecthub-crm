import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { useClientOptions } from '@/features/clients/api'
import { useProjectOptions } from '@/features/projects/api'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import {
  browserTimezone,
  eventFormSchema,
  eventStatuses,
  eventTypes,
  frequencies,
  weekdays,
  type EventFormValues,
} from './schema'

export function EventForm({
  initial,
  readOnly,
  lockType,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial: EventFormValues
  readOnly?: boolean
  lockType?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: EventFormValues) => Promise<void>
}) {
  const projects = useProjectOptions(true)
  const clients = useClientOptions(true)
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EventFormValues>({ resolver: zodResolver(eventFormSchema), defaultValues: initial })
  const frequency = useWatch({ control, name: 'frequency' })

  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof EventFormValues) => {
    const e = errors[k]
    return e && 'message' in e ? (e.message as string) : undefined
  }
  const inv = (k: keyof EventFormValues) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="title" label="Título *" error={err('title')}>
          <input id="title" className={controlClass} aria-invalid={inv('title')} {...register('title')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="event_type" label="Tipo">
            <select id="event_type" className={controlClass} disabled={lockType || readOnly} {...register('event_type')}>
              {Object.entries(eventTypes).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="status" label="Situação">
            <select id="status" className={controlClass} {...register('status')}>
              {Object.entries(eventStatuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="start_at" label="Início *" error={err('start_at')}>
            <input id="start_at" type="datetime-local" className={controlClass} aria-invalid={inv('start_at')} {...register('start_at')} />
          </Field>
          <Field id="end_at" label="Fim *" error={err('end_at')}>
            <input id="end_at" type="datetime-local" className={controlClass} aria-invalid={inv('end_at')} {...register('end_at')} />
          </Field>
          <Field id="project_id" label="Projeto">
            <select id="project_id" className={controlClass} {...register('project_id')}>
              <option value="">Sem projeto</option>
              {initial.project_id && !(projects.data ?? []).some((p) => p.id === initial.project_id) && (
                <option value={initial.project_id}>Projeto atual (arquivado)</option>
              )}
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="client_id" label="Cliente">
            <select id="client_id" className={controlClass} {...register('client_id')}>
              <option value="">Sem cliente</option>
              {initial.client_id && !(clients.data ?? []).some((c) => c.id === initial.client_id) && (
                <option value={initial.client_id}>Cliente atual (arquivado)</option>
              )}
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="space-y-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium">Repetição</legend>
          <Field id="frequency" label="Frequência" hint={`Fuso: ${browserTimezone()}. Editar altera toda a série.`}>
            <select id="frequency" className={controlClass} {...register('frequency')}>
              {Object.entries(frequencies).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {frequency !== 'none' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="interval_value" label="A cada" error={err('interval_value')}>
                <input id="interval_value" inputMode="numeric" className={controlClass} aria-invalid={inv('interval_value')} {...register('interval_value')} />
              </Field>
              <Field id="ends_on" label="Termina em" error={err('ends_on')}>
                <input id="ends_on" type="date" className={controlClass} aria-invalid={inv('ends_on')} {...register('ends_on')} />
              </Field>
              <Field id="occurrence_limit" label="Nº de ocorrências" error={err('occurrence_limit')}>
                <input id="occurrence_limit" inputMode="numeric" className={controlClass} {...register('occurrence_limit')} />
              </Field>
            </div>
          )}
          {frequency === 'weekly' && (
            <div>
              <p className="mb-1 text-sm font-medium">Dias da semana</p>
              <div className="flex flex-wrap gap-3">
                {weekdays.map((w, i) => (
                  <label key={w} className="flex min-h-11 items-center gap-1.5 text-sm">
                    <input type="checkbox" className="size-5" value={String(i)} {...register('by_weekday')} />
                    {w}
                  </label>
                ))}
              </div>
              {err('by_weekday') ? (
                <p className="text-sm text-destructive">{err('by_weekday')}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Vazio = o dia da semana do início.</p>
              )}
            </div>
          )}
        </fieldset>

        <Field id="description" label="Descrição" error={err('description')}>
          <textarea id="description" className={textareaClass} {...register('description')} />
        </Field>
      </fieldset>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      {!readOnly && (
        <Button type="submit" className="h-11" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
