import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { withCurrentOption } from '@/components/option-list'
import { controlClass, textareaClass } from '@/components/form-styles'
import { useClientOptions } from '@/features/clients/api'
import { useProjectOptions } from '@/features/projects/api'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import {
  deadlineTypes,
  taskDefaults,
  taskFormSchema,
  taskPriorities,
  taskStatuses,
  type TaskFormValues,
} from './schema'

export function TaskForm({
  initial = taskDefaults,
  readOnly,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial?: TaskFormValues
  readOnly?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: TaskFormValues) => Promise<void>
}) {
  const projects = useProjectOptions(true)
  const clients = useClientOptions(true)
  const projectOptions = withCurrentOption(projects.data, initial.project_id, projects.isPending, 'Projeto atual (arquivado)')
  const clientOptions = withCurrentOption(clients.data, initial.client_id, clients.isPending, 'Cliente atual (arquivado)')
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: initial })
  const deadline = useWatch({ control, name: 'deadline_type' })

  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof TaskFormValues) => errors[k]?.message
  const inv = (k: keyof TaskFormValues) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="title" label="Título *" error={err('title')}>
          <input id="title" className={controlClass} aria-invalid={inv('title')} {...register('title')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="status" label="Situação">
            <select id="status" className={controlClass} {...register('status')}>
              {Object.entries(taskStatuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="priority" label="Prioridade">
            <select id="priority" className={controlClass} {...register('priority')}>
              {Object.entries(taskPriorities).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="project_id" label="Projeto">
            <select id="project_id" className={controlClass} {...register('project_id')}>
              <option value="">Sem projeto</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="client_id" label="Cliente">
            <select id="client_id" className={controlClass} {...register('client_id')}>
              <option value="">Sem cliente</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="deadline_type" label="Prazo" hint="O prazo é independente do dia planejado.">
            <select id="deadline_type" className={controlClass} {...register('deadline_type')}>
              {Object.entries(deadlineTypes).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {deadline === 'date' && (
            <Field id="due_date" label="Data do prazo" error={err('due_date')}>
              <input id="due_date" type="date" className={controlClass} aria-invalid={inv('due_date')} {...register('due_date')} />
            </Field>
          )}
          {deadline === 'datetime' && (
            <Field id="due_at" label="Data e hora do prazo" error={err('due_at')}>
              <input id="due_at" type="datetime-local" className={controlClass} aria-invalid={inv('due_at')} {...register('due_at')} />
            </Field>
          )}
          <Field id="estimated_minutes" label="Estimativa (minutos)" error={err('estimated_minutes')}>
            <input
              id="estimated_minutes"
              inputMode="numeric"
              className={controlClass}
              aria-invalid={inv('estimated_minutes')}
              {...register('estimated_minutes')}
            />
          </Field>
        </div>
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
