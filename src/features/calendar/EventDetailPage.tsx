import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { toLocalInput } from '@/lib/format'
import { useCancelEvent, useEvent, useUpdateEvent } from './api'
import { EventForm } from './EventForm'
import { eventStatuses, type EventFormValues } from './schema'

export function EventDetailPage() {
  const { id = '' } = useParams()
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useEvent(id)
  const cancel = useCancelEvent()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ev = q.data
  const update = useUpdateEvent(orgId, id, ev?.recurrence_rule_id ?? null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o evento." onRetry={() => q.refetch()} />
  if (!ev) return <ErrorState message="Evento não encontrado." />

  const rule = ev.recurrence_rules as unknown as {
    frequency: 'daily' | 'weekly' | 'monthly'
    interval_value: number
    by_weekday: number[]
    ends_on: string | null
    occurrence_limit: number | null
    is_active: boolean
  } | null

  const initial: EventFormValues = {
    title: ev.title,
    description: ev.description ?? '',
    event_type: (ev.event_type === 'meeting' ? 'meeting' : 'event') as 'event' | 'meeting',
    project_id: ev.project_id ?? '',
    client_id: ev.client_id ?? '',
    start_at: toLocalInput(ev.starts_at),
    end_at: toLocalInput(ev.ends_at),
    status: ev.status as 'scheduled',
    frequency: rule ? rule.frequency : 'none',
    interval_value: String(rule?.interval_value ?? 1),
    by_weekday: (rule?.by_weekday ?? []).map(String),
    ends_on: rule?.ends_on ?? '',
    occurrence_limit: rule?.occurrence_limit ? String(rule.occurrence_limit) : '',
  }

  return (
    <>
      <PageHeader
        title={ev.title}
        actions={
          <>
            <StatusBadge tone={ev.status === 'cancelled' ? 'danger' : 'neutral'}>
              {eventStatuses[ev.status as keyof typeof eventStatuses] ?? ev.status}
            </StatusBadge>
            {ev.event_type === 'meeting' && (
              <Button asChild variant="outline">
                <Link to={`/app/reunioes/${ev.id}`}>Abrir reunião</Link>
              </Button>
            )}
            {canWrite && ev.status !== 'cancelled' && (
              <Button
                variant="outline"
                disabled={cancel.isPending}
                onClick={async () => {
                  setError(null)
                  try {
                    await cancel.mutateAsync(ev.id)
                    setMessage('Evento cancelado.')
                  } catch {
                    setError('Não foi possível cancelar.')
                  }
                }}
              >
                Cancelar evento
              </Button>
            )}
          </>
        }
      />
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <EventForm
        key={ev.updated_at}
        initial={initial}
        lockType
        readOnly={!canWrite}
        submitLabel="Salvar alterações"
        serverError={error}
        onSubmit={async (values) => {
          setError(null)
          setMessage(null)
          try {
            await update.mutateAsync(values)
            setMessage('Alterações salvas.')
          } catch {
            setError('Não foi possível salvar. Verifique os dados e tente novamente.')
          }
        }}
      />
    </>
  )
}
