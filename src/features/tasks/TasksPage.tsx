import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RowCheckbox } from '@/components/RowCheckbox'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useProjectOptions } from '@/features/projects/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate, formatDateTime } from '@/lib/format'
import { PAGE_SIZE, useQuickCreateTask, useSetTaskStatus, useTasks, type TaskListParams } from './api'
import { QuickCapture } from './QuickCapture'
import { taskPriorities, taskStatuses } from './schema'

export function TasksPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [searchParams] = useSearchParams()
  const [params, setParams] = useState<TaskListParams>({
    search: '',
    status: 'open',
    priority: '',
    // Vindo do detalhe do projeto ("Ver todas"): /app/tarefas?projeto=<id>
    projectId: searchParams.get('projeto') ?? '',
    page: 0,
  })
  const q = useTasks(params, Boolean(orgId))
  const projects = useProjectOptions(Boolean(orgId))
  const create = useQuickCreateTask(orgId)
  const setStatus = useSetTaskStatus()
  const set = (patch: Partial<TaskListParams>) => setParams((p) => ({ ...p, page: 0, ...patch }))
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const filtered = Boolean(params.search || params.priority || params.projectId || params.status !== 'open')

  return (
    <>
      <PageHeader
        title="Tarefas"
        actions={
          <Button asChild variant="outline">
            <Link to="/app/tarefas/modelos">Modelos de checklist</Link>
          </Button>
        }
      />

      {canWrite && <QuickCapture onCreate={async (title) => void (await create.mutateAsync({ title }))} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          aria-label="Buscar tarefas"
          placeholder="Buscar por título"
          className={controlClass}
          value={params.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        <select
          aria-label="Situação"
          className={controlClass}
          value={params.status}
          onChange={(e) => set({ status: e.target.value as TaskListParams['status'] })}
        >
          <option value="open">Abertas</option>
          <option value="all">Todas</option>
          {Object.entries(taskStatuses).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Prioridade"
          className={controlClass}
          value={params.priority}
          onChange={(e) => set({ priority: e.target.value as TaskListParams['priority'] })}
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(taskPriorities).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Projeto"
          className={controlClass}
          value={params.projectId}
          onChange={(e) => set({ projectId: e.target.value })}
        >
          <option value="">Todos os projetos</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as tarefas." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && (
        <EmptyState
          title="Nenhuma tarefa encontrada"
          description={filtered ? 'Ajuste os filtros.' : 'Capture a primeira tarefa acima.'}
        />
      )}

      {q.isSuccess && count > 0 && (
        <>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {q.data.rows.map((t) => {
              const done = t.status === 'done'
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                  <RowCheckbox
                    label={`Concluir ${t.title}`}
                    checked={done}
                    disabled={!canWrite || setStatus.isPending}
                    onChange={() => setStatus.mutate({ id: t.id, status: done ? 'todo' : 'done' })}
                  />
                  <Link to={`/app/tarefas/${t.id}`} className="flex min-h-11 flex-1 flex-wrap items-center justify-between gap-2">
                    <span className={done ? 'text-muted-foreground line-through' : 'font-medium'}>
                      {t.title}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {t.projectName ?? ''}
                        {(t.due_at || t.due_date) && ` · prazo ${t.due_at ? formatDateTime(t.due_at) : formatDate(t.due_date)}`}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {t.status === 'cancelled' && <StatusBadge>Cancelada</StatusBadge>}
                      <StatusBadge tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'}>
                        {taskPriorities[t.priority as keyof typeof taskPriorities] ?? t.priority}
                      </StatusBadge>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {count} tarefa{count === 1 ? '' : 's'} · página {params.page + 1} de {pages}
            </span>
            <span className="flex gap-2">
              <Button variant="outline" disabled={params.page === 0} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>
                Anterior
              </Button>
              <Button variant="outline" disabled={params.page + 1 >= pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                Próxima
              </Button>
            </span>
          </nav>
        </>
      )}
    </>
  )
}
