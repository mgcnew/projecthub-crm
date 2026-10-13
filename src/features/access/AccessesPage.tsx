import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useProjectOptions } from '@/features/projects/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { ACCESS_LIMIT, useAccessEntries, type ArchivedFilter } from './api'
import { AccessList } from './AccessList'

export function AccessesPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState<ArchivedFilter>('active')
  const projectId = params.get('projeto') ?? ''
  const projects = useProjectOptions(Boolean(orgId))
  const q = useAccessEntries({ search, archived, projectId: projectId || undefined }, Boolean(orgId))
  const count = q.data?.count ?? 0
  const filtered = Boolean(search || projectId || archived !== 'active')

  return (
    <>
      <PageHeader
        title="Acessos"
        description="Onde estão suas contas e como chegar nelas. Senhas ficam no seu gerenciador de senhas."
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/acessos/novo">Novo acesso</Link>
            </Button>
          )
        }
      />

      <FilterBar
        className="md:grid-cols-[minmax(0,1fr)_14rem_13rem]"
        activeCount={(projectId ? 1 : 0) + (archived !== 'active' ? 1 : 0)}
        search={
          <input
            aria-label="Buscar acessos"
            placeholder="Buscar por serviço, usuário ou categoria"
            className={controlClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      >
        <select
          aria-label="Projeto"
          className={controlClass}
          value={projectId}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            if (e.target.value) next.set('projeto', e.target.value)
            else next.delete('projeto')
            setParams(next, { replace: true })
          }}
        >
          <option value="">Todos os projetos</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Arquivamento"
          className={controlClass}
          value={archived}
          onChange={(e) => setArchived(e.target.value as ArchivedFilter)}
        >
          <option value="active">Não arquivados</option>
          <option value="archived">Arquivados</option>
          <option value="all">Todos</option>
        </select>
      </FilterBar>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os acessos." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && (
        <EmptyState
          title="Nenhum acesso encontrado"
          description={filtered ? 'Ajuste os filtros.' : 'Cadastre o primeiro: serviço, endereço e usuário.'}
          action={
            canWrite && !filtered ? (
              <Button asChild>
                <Link to="/app/acessos/novo">Novo acesso</Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {q.isSuccess && count > 0 && (
        <>
          <AccessList rows={q.data.rows} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound aria-hidden="true" className="size-4 shrink-0" />
            {count > ACCESS_LIMIT ? `Mostrando ${ACCESS_LIMIT} de ${count}. Refine a busca.` : `${count} acesso${count === 1 ? '' : 's'}.`}
          </p>
        </>
      )}
    </>
  )
}
