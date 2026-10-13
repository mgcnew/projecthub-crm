import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import type { LinkScope } from '@/features/tasks/api'
import { useLinkedEvents } from './api'
import { newEventHref } from './links'

type LinkedEventRow = NonNullable<ReturnType<typeof useLinkedEvents>['data']>['upcoming'][number]

const typeLabel: Record<string, string> = { event: 'Evento', meeting: 'Reunião' }

/** Reuniões e eventos ligados a um projeto ou cliente: próximos primeiro, depois os mais recentes. */
export function LinkedEvents({
  scope,
  link,
  ready = true,
}: {
  scope: LinkScope
  /** Vínculos aplicados ao criar um evento a partir daqui. */
  link: { projectId?: string; clientId?: string }
  ready?: boolean
}) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useLinkedEvents(scope, Boolean(orgId) && ready)

  const upcoming = q.data?.upcoming ?? []
  const past = q.data?.past ?? []

  const row = (e: LinkedEventRow) => (
    <li key={e.id}>
      <Link
        to={e.event_type === 'meeting' ? `/app/reunioes/${e.id}` : `/app/agenda/${e.id}`}
        className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 px-4 py-2 hover:bg-muted"
      >
        <span className="font-medium">{e.title}</span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {e.recurrence_rule_id && <StatusBadge>Recorrente</StatusBadge>}
          <StatusBadge tone={e.event_type === 'meeting' ? 'info' : 'neutral'}>{typeLabel[e.event_type] ?? e.event_type}</StatusBadge>
          {formatDateTime(e.starts_at)}
        </span>
      </Link>
    </li>
  )

  return (
    <section aria-labelledby="linked-events-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="linked-events-h" className="text-lg font-semibold">
          Reuniões e eventos
        </h2>
        {canWrite && (
          <span className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={newEventHref('meeting', link)}>Nova reunião</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={newEventHref('event', link)}>Novo evento</Link>
            </Button>
          </span>
        )}
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os eventos." onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.total === 0 && <p className="text-sm text-muted-foreground">Nenhuma reunião ou evento.</p>}
      {upcoming.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">Próximos</h3>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">{upcoming.map(row)}</ul>
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">Anteriores</h3>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">{past.map(row)}</ul>
        </div>
      )}
    </section>
  )
}
