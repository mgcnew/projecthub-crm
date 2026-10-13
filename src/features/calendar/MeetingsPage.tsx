import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LineBadge } from '@/components/LineBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useMeetings } from './api'
import { eventStatuses } from './schema'

const PAGE_SIZE = 20

export function MeetingsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [page, setPage] = useState(0)
  const q = useMeetings(page, PAGE_SIZE, Boolean(orgId))
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="Reuniões"
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/agenda/novo?tipo=reuniao">Nova reunião</Link>
            </Button>
          )
        }
      />
      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as reuniões." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && <EmptyState title="Nenhuma reunião cadastrada" />}
      {q.isSuccess && count > 0 && (
        <>
          <ul className="plate divide-y divide-border">
            {q.data.rows.map((m) => (
              <li key={m.id}>
                <Link to={`/app/reunioes/${m.id}`} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-muted/60 sm:px-5">
                  <LineBadge
                    projectId={m.project_id}
                    projectName={(m.projects as unknown as { name: string } | null)?.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{m.title}</span>
                    <span className="block text-sm text-muted-foreground tabular-nums">
                      {formatDateTime(m.starts_at)}
                      {(m.projects as unknown as { name: string } | null)?.name &&
                        ` · ${(m.projects as unknown as { name: string }).name}`}
                    </span>
                  </span>
                  <StatusBadge tone={m.status === 'cancelled' ? 'danger' : 'neutral'}>
                    {eventStatuses[m.status as keyof typeof eventStatuses] ?? m.status}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {count} reunião(ões) · página {page + 1} de {pages}
            </span>
            <span className="flex gap-2">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </span>
          </nav>
        </>
      )}
    </>
  )
}
