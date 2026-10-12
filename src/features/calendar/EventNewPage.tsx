import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { toISODate } from '@/lib/format'
import { useCreateEvent } from './api'
import { EventForm } from './EventForm'
import { eventDefaults } from './schema'

function defaultTimes() {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  const end = new Date(now.getTime() + 60 * 60 * 1000)
  const fmt = (d: Date) => `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:00`
  return { start: fmt(now), end: fmt(end) }
}

export function EventNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateEvent(orgId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) return <p role="alert">Você não tem permissão para criar eventos.</p>
  const t = defaultTimes()
  const isMeeting = params.get('tipo') === 'reuniao'

  return (
    <>
      <PageHeader title={isMeeting ? 'Nova reunião' : 'Novo evento'} />
      <EventForm
        initial={{ ...eventDefaults(t.start, t.end), event_type: isMeeting ? 'meeting' : 'event' }}
        submitLabel="Criar"
        serverError={error}
        onSubmit={async (values) => {
          setError(null)
          try {
            const created = await create.mutateAsync(values)
            navigate(created.event_type === 'meeting' ? `/app/reunioes/${created.id}` : `/app/agenda/${created.id}`, {
              replace: true,
            })
          } catch {
            setError('Não foi possível salvar. Verifique os dados e tente novamente.')
          }
        }}
      />
    </>
  )
}
