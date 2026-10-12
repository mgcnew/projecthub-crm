import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useClientOptions } from '@/features/clients/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { PAGE_SIZE, useProjects, type ArchivedFilter, type ProjectListParams } from './api'
import { projectPriorities, projectStatuses } from './schema'

export function ProjectsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [params, setParams] = useState<ProjectListParams>({
    search: '',
    status: '',
    clientId: '',
    archived: 'active',
    page: 0,
  })
  const q = useProjects(params, Boolean(orgId))
  const clients = useClientOptions(Boolean(orgId))
  const set = (patch: Partial<ProjectListParams>) => setParams((p) => ({ ...p, page: 0, ...patch }))
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          aria-label="Buscar projetos"
          placeholder="Buscar por nome"
          className={controlClass}
          value={params.search}
          onChange={(e) => set({ search: e.target.value })}
        />
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
      </div>

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
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {q.data.rows.map((p) => {
              const clientName = (p.clients as unknown as { name: string } | null)?.name
              return (
                <li key={p.id}>
                  <Link to={`/app/projetos/${p.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {clientName ?? 'Sem cliente'} · prazo {formatDate(p.target_date)}
                      </span>
                    </span>
                    <span className="flex gap-2">
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
