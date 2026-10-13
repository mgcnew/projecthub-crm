import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RowCheckbox } from '@/components/RowCheckbox'
import { ErrorState, LoadingState } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate, formatDateTime } from '@/lib/format'
import { useLinkedTasks, useQuickCreateTask, useSetTaskStatus, type LinkScope } from './api'
import { QuickCapture } from './QuickCapture'

/** Tarefas abertas ligadas a um projeto ou cliente, com captura rápida já vinculada. */
export function LinkedTasks({ scope, ready = true }: { scope: LinkScope; ready?: boolean }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useLinkedTasks(scope, Boolean(orgId) && ready)
  const create = useQuickCreateTask(orgId)
  const setStatus = useSetTaskStatus()
  const isProject = 'projectId' in scope
  const rows = q.data?.rows ?? []
  const total = q.data?.count ?? 0

  return (
    <section aria-labelledby="linked-tasks-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="linked-tasks-h" className="text-lg font-semibold">
          Tarefas
          {q.isSuccess && <span className="ml-2 text-sm font-normal text-muted-foreground">{total} aberta{total === 1 ? '' : 's'}</span>}
        </h2>
        {isProject && (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/app/tarefas?projeto=${scope.projectId}`}>Ver todas</Link>
          </Button>
        )}
      </div>

      {canWrite && (
        <QuickCapture
          label={isProject ? 'Nova tarefa neste projeto' : 'Nova tarefa para este cliente'}
          placeholder={isProject ? 'Nova tarefa neste projeto' : 'Nova tarefa para este cliente'}
          onCreate={async (title) =>
            void (await create.mutateAsync(
              isProject ? { title, projectId: scope.projectId } : { title, clientId: scope.clientId },
            ))
          }
        />
      )}

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as tarefas." onRetry={() => q.refetch()} />}
      {q.isSuccess && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa aberta.</p>}
      {rows.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-1 pr-4 pl-2">
                <RowCheckbox
                  label={`Concluir ${t.title}`}
                  checked={false}
                  disabled={!canWrite || setStatus.isPending}
                  onChange={() => setStatus.mutate({ id: t.id, status: 'done' })}
                />
                <Link to={`/app/tarefas/${t.id}`} className="flex min-h-11 flex-1 flex-wrap items-center justify-between gap-x-3">
                  <span className="font-medium">{t.title}</span>
                  {(t.due_at || t.due_date) && (
                    <span className="text-sm text-muted-foreground">
                      prazo {t.due_at ? formatDateTime(t.due_at) : formatDate(t.due_date)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {total > rows.length && (
            <p className="text-sm text-muted-foreground">
              Mostrando {rows.length} de {total}.
              {isProject && ' Use "Ver todas" para a lista completa.'}
            </p>
          )}
        </>
      )}
    </section>
  )
}
