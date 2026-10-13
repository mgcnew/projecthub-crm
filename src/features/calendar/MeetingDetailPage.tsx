import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { textareaClass } from '@/components/form-styles'
import { EntityView, type EntityTab } from '@/components/entity/EntityView'
import { ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { QuickCapture } from '@/features/tasks/QuickCapture'
import { taskStatuses } from '@/features/tasks/schema'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { useCreateMeetingTask, useMeeting, useMeetingTasks, useUpdateMeeting } from './api'
import { meetingFormSchema, type MeetingFormValues } from './schema'

function MeetingForm({
  meetingId,
  initial,
  readOnly,
}: {
  meetingId: string
  initial: MeetingFormValues
  readOnly: boolean
}) {
  const update = useUpdateMeeting(meetingId)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<MeetingFormValues>({ resolver: zodResolver(meetingFormSchema), defaultValues: initial })
  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    setError(null)
    setMessage(null)
    try {
      await update.mutateAsync(values)
      reset(values)
      setMessage('Reunião salva.')
    } catch {
      setError('Não foi possível salvar a reunião.')
    }
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="agenda" label="Pauta" error={errors.agenda?.message}>
          <textarea id="agenda" className={textareaClass} {...register('agenda')} />
        </Field>
        <Field id="notes" label="Anotações" error={errors.notes?.message}>
          <textarea id="notes" className={textareaClass} {...register('notes')} />
        </Field>
        <Field id="decisions" label="Decisões" error={errors.decisions?.message}>
          <textarea id="decisions" className={textareaClass} {...register('decisions')} />
        </Field>
      </fieldset>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!readOnly && (
        <Button type="submit" className="h-11" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar reunião'}
        </Button>
      )}
    </form>
  )
}

export function MeetingDetailPage() {
  const { eventId = '' } = useParams()
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useMeeting(eventId)
  const tasks = useMeetingTasks(q.data?.id)
  const createTask = useCreateMeetingTask(orgId, q.data?.id)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar a reunião." onRetry={() => q.refetch()} />
  const m = q.data
  if (!m) return <ErrorState message="Reunião não encontrada." />
  const ev = m.calendar_events as unknown as { title: string; starts_at: string; status: string } | null

  const tabs: EntityTab[] = [
    {
      id: 'reuniao',
      label: 'Pauta e notas',
      content: (
        <>
          <MeetingForm
            meetingId={m.id}
            readOnly={!canWrite}
            initial={{ agenda: m.agenda ?? '', notes: m.notes ?? '', decisions: m.decisions ?? '' }}
          />
        </>
      ),
    },
    {
      id: 'tarefas',
      label: 'Tarefas geradas',
      content: (
        <>
          <section aria-labelledby="meeting-tasks" className="space-y-3">
            <h2 id="meeting-tasks" className="section-title">
              Tarefas geradas
            </h2>
            {tasks.isSuccess && tasks.data.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada a esta reunião.</p>
            )}
            {(tasks.data ?? []).length > 0 && (
              <ul className="plate divide-y divide-border">
                {tasks.data!.map((t) => (
                  <li key={t.id}>
                    <Link to={`/app/tarefas/${t.id}`} className="flex min-h-11 items-center justify-between px-4 hover:bg-muted">
                      <span className={t.status === 'done' ? 'text-muted-foreground line-through' : ''}>{t.title}</span>
                      <StatusBadge tone={t.status === 'done' ? 'success' : 'neutral'}>
                        {taskStatuses[t.status as keyof typeof taskStatuses] ?? t.status}
                      </StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <QuickCapture
                label="Nova tarefa da reunião"
                placeholder="Nova tarefa a partir desta reunião"
                onCreate={async (title) => void (await createTask.mutateAsync(title))}
              />
            )}
          </section>
        </>
      ),
    },
  ]

  return (
    <EntityView
    kind="Reunião"
    tabs={tabs}
      title={ev?.title ?? 'Reunião'}
      description={ev ? formatDateTime(ev.starts_at) : undefined}
      actions={
        <>
          {ev?.status === 'cancelled' && <StatusBadge tone="danger">Cancelada</StatusBadge>}
          <Button asChild variant="outline">
            <Link to={`/app/agenda/${eventId}`}>Editar evento</Link>
          </Button>
        </>
      }
    />
  )
}
