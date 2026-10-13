import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { useProjectOptions } from '@/features/projects/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { PAGE_SIZE, useQuickCreateTask, useSetTaskStatus, useTasks, type TaskListParams } from './api'
import { QuickCapture } from './QuickCapture'
import { TaskTable } from './TaskTable'
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

      <FilterBar
        className="md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
        activeCount={(params.status !== 'open' ? 1 : 0) + (params.priority ? 1 : 0) + (params.projectId ? 1 : 0)}
        search={
        <input
          aria-label="Buscar tarefas"
          placeholder="Buscar por título"
          className={controlClass}
          value={params.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        }
      >
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
      </FilterBar>

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
          <div className="plate px-4 pb-1 sm:px-5">
            <TaskTable
              rows={q.data.rows}
              caption="Tarefas"
              canWrite={canWrite}
              pending={setStatus.isPending}
              showEstimate={false}
              showPriority
              onToggle={(t, done) => setStatus.mutate({ id: t.id, status: done ? 'done' : 'todo' })}
            />
          </div>
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
