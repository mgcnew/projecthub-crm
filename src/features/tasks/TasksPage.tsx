import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { useProjectOptions } from '@/features/projects/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { objectValidator, usePersistedState } from '@/lib/usePersistedState'
import {
  PAGE_SIZE,
  defaultDir,
  useQuickCreateTask,
  useSetTaskStatus,
  useTasks,
  type SortDir,
  type TaskListParams,
  type TaskSort,
} from './api'
import { QuickCapture } from './QuickCapture'
import { TaskTable } from './TaskTable'
import { taskPriorities, taskStatuses } from './schema'

// Filtros e ordenação lembrados entre visitas (por navegador). A busca por texto e a página não.
type Remembered = Pick<TaskListParams, 'status' | 'priority' | 'projectId' | 'sort' | 'dir'>
const REMEMBERED_DEFAULTS: Remembered = { status: 'open', priority: '', projectId: '', sort: 'prazo', dir: 'asc' }
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (values as readonly string[]).includes(v)
const validateRemembered = objectValidator(REMEMBERED_DEFAULTS, {
  status: oneOf(['open', 'all', 'todo', 'in_progress', 'done', 'cancelled'] as const),
  priority: oneOf(['', 'low', 'medium', 'high', 'urgent'] as const),
  projectId: (v): v is string => typeof v === 'string' && v.length <= 64,
  sort: oneOf(['prazo', 'prioridade', 'titulo', 'criada'] as const),
  dir: oneOf(['asc', 'desc'] as const),
})
const sortLabels: Record<TaskSort, string> = {
  prazo: 'Prazo (mais próximo)',
  prioridade: 'Prioridade (maior primeiro)',
  titulo: 'Título (A–Z)',
  criada: 'Mais recentes',
}

export function TasksPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [searchParams] = useSearchParams()
  const [remembered, setRemembered, resetRemembered] = usePersistedState(
    'projecthub:tasks-view',
    REMEMBERED_DEFAULTS,
    validateRemembered,
  )
  const [view, setView] = useState({ search: '', page: 0 })
  // Vindo do detalhe do projeto ("Ver todas"): /app/tarefas?projeto=<id> vale mais que o lembrado.
  const urlProject = searchParams.get('projeto')
  const params: TaskListParams = { ...remembered, ...view, projectId: urlProject ?? remembered.projectId }
  const q = useTasks(params, Boolean(orgId))
  const projects = useProjectOptions(Boolean(orgId))
  const create = useQuickCreateTask(orgId)
  const setStatus = useSetTaskStatus()
  const set = (patch: Partial<TaskListParams>) => {
    const { search, page: _page, ...rest } = patch
    void _page
    if (Object.keys(rest).length) setRemembered((r) => ({ ...r, ...(rest as Partial<Remembered>) }))
    setView((v) => ({ search: search ?? v.search, page: 0 }))
  }
  const sortBy = (key: string) => {
    const k = key as TaskSort
    set(params.sort === k ? { dir: (params.dir === 'asc' ? 'desc' : 'asc') as SortDir } : { sort: k, dir: defaultDir[k] })
  }
  const customised = JSON.stringify(remembered) !== JSON.stringify(REMEMBERED_DEFAULTS)
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const filtered = Boolean(params.search || params.priority || params.projectId || params.status !== 'open')
  const activeFilters = (params.status !== 'open' ? 1 : 0) + (params.priority ? 1 : 0) + (params.projectId ? 1 : 0)

  return (
    <>
      <PageHeader
        title="Tarefas"
        actions={
          <>
            {customised && (
              <Button variant="ghost" onClick={resetRemembered}>
                Limpar filtros e ordem
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/app/tarefas/modelos">Modelos de checklist</Link>
            </Button>
          </>
        }
      />

      {canWrite && <QuickCapture onCreate={async (title) => void (await create.mutateAsync({ title }))} />}

      <FilterBar
        className="md:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]"
        activeCount={activeFilters}
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
        <select
          aria-label="Ordenar por"
          className={controlClass}
          value={params.sort}
          onChange={(e) => {
            const k = e.target.value as TaskSort
            set({ sort: k, dir: defaultDir[k] })
          }}
        >
          {(Object.keys(sortLabels) as TaskSort[]).map((k) => (
            <option key={k} value={k}>
              {sortLabels[k]}
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
              sort={{ key: params.sort, dir: params.dir }}
              onSort={sortBy}
              onToggle={(t, done) => setStatus.mutate({ id: t.id, status: done ? 'done' : 'todo' })}
            />
          </div>
          <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {count} tarefa{count === 1 ? '' : 's'} · página {params.page + 1} de {pages}
            </span>
            <span className="flex gap-2">
              <Button variant="outline" disabled={params.page === 0} onClick={() => setView((v) => ({ ...v, page: v.page - 1 }))}>
                Anterior
              </Button>
              <Button variant="outline" disabled={params.page + 1 >= pages} onClick={() => setView((v) => ({ ...v, page: v.page + 1 }))}>
                Próxima
              </Button>
            </span>
          </nav>
        </>
      )}
    </>
  )
}
