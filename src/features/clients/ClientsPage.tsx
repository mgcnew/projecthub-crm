import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { PAGE_SIZE, useClients, type ArchivedFilter, type ClientListParams } from './api'
import { clientStatuses } from './schema'

export function ClientsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [params, setParams] = useState<ClientListParams>({ search: '', status: '', archived: 'active', page: 0 })
  const q = useClients(params, Boolean(orgId))
  const set = (patch: Partial<ClientListParams>) => setParams((p) => ({ ...p, page: 0, ...patch }))
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/clientes/novo">Novo cliente</Link>
            </Button>
          )
        }
      />

      <FilterBar
        className="md:grid-cols-[minmax(0,1fr)_14rem_13rem]"
        activeCount={(params.status ? 1 : 0) + (params.archived !== 'active' ? 1 : 0)}
        search={
        <input
          aria-label="Buscar clientes"
          placeholder="Buscar por nome ou empresa"
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
          onChange={(e) => set({ status: e.target.value as ClientListParams['status'] })}
        >
          <option value="">Todas as situações</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
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
      {q.isError && <ErrorState message="Não foi possível carregar os clientes." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && (
        <EmptyState
          title="Nenhum cliente encontrado"
          description={params.search || params.status || params.archived !== 'active' ? 'Ajuste os filtros.' : 'Cadastre o primeiro cliente.'}
          action={
            canWrite && !params.search ? (
              <Button asChild>
                <Link to="/app/clientes/novo">Novo cliente</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {q.isSuccess && count > 0 && (
        <>
          <ul className="plate divide-y divide-border">
            {q.data.rows.map((c) => (
              <li key={c.id}>
                <Link to={`/app/clientes/${c.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 hover:bg-muted/60 sm:px-5">
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.name}</span>
                    {c.company_name && <span className="block text-sm text-muted-foreground">{c.company_name}</span>}
                  </span>
                  <span className="flex gap-2">
                    {c.archived_at && <StatusBadge>Arquivado</StatusBadge>}
                    <StatusBadge tone={c.status === 'active' ? 'neutral' : 'success'}>
                      {clientStatuses[c.status as keyof typeof clientStatuses] ?? c.status}
                    </StatusBadge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {count} cliente{count === 1 ? '' : 's'} · página {params.page + 1} de {pages}
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
