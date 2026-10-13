import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { Button } from '@/components/ui/button'
import { LineBadge } from '@/components/LineBadge'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useClientOptions } from '@/features/clients/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { objectValidator, usePersistedState } from '@/lib/usePersistedState'
import { PAGE_SIZE, useProjects, type ArchivedFilter, type ProjectListParams } from './api'
import { projectPriorities, projectStatuses } from './schema'

type Remembered = Pick<ProjectListParams, 'status' | 'clientId' | 'archived'>
const REMEMBERED_DEFAULTS: Remembered = { status: '', clientId: '', archived: 'active' }
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (values as readonly string[]).includes(v)
const validateRemembered = objectValidator(REMEMBERED_DEFAULTS, {
  status: oneOf(['', 'planning', 'active', 'on_hold', 'completed', 'cancelled'] as const),
  clientId: (v): v is string => typeof v === 'string' && v.length <= 64,
  archived: oneOf(['active', 'archived', 'all'] as const),
})

export function ProjectsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [remembered, setRemembered] = usePersistedState('projecthub:projects-view', REMEMBERED_DEFAULTS, validateRemembered)
  const [view, setView] = useState({ search: '', page: 0 })
  const params: ProjectListParams = { ...remembered, ...view }
  const q = useProjects(params, Boolean(orgId))
  const clients = useClientOptions(Boolean(orgId))
  const set = (patch: Partial<ProjectListParams>) => {
    const { search, page: _page, ...rest } = patch
    void _page
    if (Object.keys(rest).length) setRemembered((r) => ({ ...r, ...(rest as Partial<Remembered>) }))
    setView((v) => ({ search: search ?? v.search, page: 0 }))
  }
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const filtered = Boolean(params.search || params.status || params.clientId || params.archived !== 'active')

  return (
    <>
      <PageHeader
        title="Projetos"
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/projetos/novo">Novo projeto</Link>
            </Button>
          )
        }
      />

      <FilterBar
        className="md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
        activeCount={(params.status ? 1 : 0) + (params.clientId ? 1 : 0) + (params.archived !== 'active' ? 1 : 0)}
        search={
        <input
          aria-label="Buscar projetos"
          placeholder="Buscar por nome"
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
          onChange={(e) => set({ status: e.target.value as ProjectListParams['status'] })}
        >
          <option value="">Todas as situações</option>
          {Object.entries(projectStatuses).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Cliente"
          className={controlClass}
          value={params.clientId}
          onChange={(e) => set({ clientId: e.target.value })}
        >
          <option value="">Todos os clientes</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Arquivamento"
          className={controlClass}
          value={params.archived}
          onChange={(e) => set({ archived: e.target.value as ArchivedFilter })}
        >
          <option value="active">Não arquivados</option>
          <option value="archived">Arquivados</option>
          <option value="all">Todos</option>
        </select>
      </FilterBar>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os projetos." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && (
        <EmptyState
          title="Nenhum projeto encontrado"
          description={filtered ? 'Ajuste os filtros.' : 'Crie o primeiro projeto.'}
          action={
            canWrite && !filtered ? (
              <Button asChild>
                <Link to="/app/projetos/novo">Novo projeto</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {q.isSuccess && count > 0 && (
        <>
          <ul className="plate divide-y divide-border">
            {q.data.rows.map((p) => {
              const clientName = (p.clients as unknown as { name: string } | null)?.name
              return (
                <li key={p.id}>
                  <Link to={`/app/projetos/${p.id}`} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-muted/60 sm:px-5">
                    <LineBadge projectId={p.id} projectName={p.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {clientName ?? 'Sem cliente'}
                        {p.target_date && ` · prazo ${formatDate(p.target_date)}`}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {p.archived_at && <StatusBadge>Arquivado</StatusBadge>}
                      <StatusBadge tone={p.priority === 'urgent' ? 'danger' : p.priority === 'high' ? 'warning' : 'neutral'}>
                        {projectPriorities[p.priority as keyof typeof projectPriorities] ?? p.priority}
                      </StatusBadge>
                      <StatusBadge tone="info">
                        {projectStatuses[p.status as keyof typeof projectStatuses] ?? p.status}
                      </StatusBadge>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {count} projeto{count === 1 ? '' : 's'} · página {params.page + 1} de {pages}
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
