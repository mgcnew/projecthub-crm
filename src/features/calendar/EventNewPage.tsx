import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { fromLocalInput, toLocalInput } from '@/lib/format'
import { useCreateEvent } from './api'
import { EventForm } from './EventForm'
import { eventDefaults } from './schema'

/** Próxima hora cheia no fuso de trabalho, com duração de 1 h. */
function defaultTimes() {
  const now = toLocalInput(new Date().toISOString()).slice(0, 13) + ':00'
  const start = new Date(fromLocalInput(now)!).getTime() + 60 * 60 * 1000
  return { start: toLocalInput(new Date(start).toISOString()), end: toLocalInput(new Date(start + 60 * 60 * 1000).toISOString()) }
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
    <EntityView
      kind="Evento"
      title={isMeeting ? 'Nova reunião' : 'Novo evento'}
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <EventForm
              initial={{
                ...eventDefaults(t.start, t.end),
                event_type: isMeeting ? 'meeting' : 'event',
                project_id: params.get('projeto') ?? '',
                client_id: params.get('cliente') ?? '',
              }}
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
          ),
        },
      ]}
    />
  )
}
