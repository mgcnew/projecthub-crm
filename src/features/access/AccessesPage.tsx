import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { controlClass } from '@/components/form-styles'
import { LineBadge } from '@/components/LineBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { usePersistedState } from '@/lib/usePersistedState'
import {
  ACCESS_LIMIT,
  NO_PROJECT,
  useAccessCategories,
  useAccessEntries,
  useAccessProjectOptions,
  type ArchivedFilter,
} from './api'
import { groupByProject } from './group'
import { AccessList } from './AccessList'

const validateBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

/** Filtros na URL (`?projeto=`, `?categoria=`): o link de um projeto ou categoria abre já filtrado. */
function useUrlFilter(name: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(name) ?? ''
  const set = (next: string) => {
    const p = new URLSearchParams(params)
    if (next) p.set(name, next)
    else p.delete(name)
    setParams(p, { replace: true })
  }
  return [value, set] as const
}

export function AccessesPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const enabled = Boolean(orgId)
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState<ArchivedFilter>('active')
  const [projectId, setProjectId] = useUrlFilter('projeto')
  const [category, setCategory] = useUrlFilter('categoria')
  const [grouped, setGrouped] = usePersistedState('projecthub:access-grouped', true, validateBool)
  const projects = useAccessProjectOptions(enabled)
  const categories = useAccessCategories(enabled)
  const q = useAccessEntries({ search, archived, projectId: projectId || undefined, category: category || undefined }, enabled)
  const count = q.data?.count ?? 0
  const filtered = Boolean(search || projectId || category || archived !== 'active')
  const activeFilters = (projectId ? 1 : 0) + (category ? 1 : 0) + (archived !== 'active' ? 1 : 0)
  const selectedProject = projects.data?.find((p) => p.id === projectId)
  // Com um projeto escolhido a lista já é dele: sem agrupar.
  const showGroups = grouped && !projectId
  const groups = q.isSuccess && showGroups ? groupByProject(q.data.rows) : []
  const newHref = `/app/acessos/novo${projectId && projectId !== NO_PROJECT ? `?projeto=${projectId}` : ''}`
  const categoryOptions = [...new Set([...(categories.data ?? []), ...(category ? [category] : [])])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )

  return (
    <>
      <PageHeader
        title="Acessos"
        description="Onde estão suas contas e como chegar nelas. Senhas ficam no seu gerenciador de senhas."
        actions={
          canWrite && (
            <Button asChild>
              <Link to={newHref}>Novo acesso</Link>
            </Button>
          )
        }
      />

      <FilterBar
        className="md:grid-cols-[minmax(0,1fr)_14rem_12rem_12rem]"
        activeCount={activeFilters}
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
        <select aria-label="Projeto" className={controlClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todos os projetos</option>
          <option value={NO_PROJECT}>Sem projeto</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.archived_at ? ' (arquivado)' : ''}
            </option>
          ))}
        </select>
        <select aria-label="Categoria" className={controlClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
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

      {(selectedProject || projectId === NO_PROJECT) && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mostrando os acessos de</span>
          {selectedProject ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span aria-hidden="true">
                <LineBadge projectId={selectedProject.id} projectName={selectedProject.name} size="sm" />
              </span>
              <Link to={`/app/projetos/${selectedProject.id}`} className="hover:underline">
                {selectedProject.name}
              </Link>
            </span>
          ) : (
            <span className="font-semibold">acessos sem projeto</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setProjectId('')}>
            Ver todos
          </Button>
        </p>
      )}

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os acessos." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && (
        <EmptyState
          icon={KeyRound}
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound aria-hidden="true" className="size-4 shrink-0" />
              {count > ACCESS_LIMIT
                ? `Mostrando ${ACCESS_LIMIT} de ${count}. Refine a busca.`
                : `${count} acesso${count === 1 ? '' : 's'}.`}
            </p>
            {!projectId && (
              <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
                Agrupar por projeto
              </label>
            )}
          </div>
          {showGroups ? (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`grp-${g.key}`} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {g.projectId && (
                      <span aria-hidden="true">
                        <LineBadge projectId={g.projectId} projectName={g.name} size="sm" />
                      </span>
                    )}
                    <h2 id={`grp-${g.key}`} className="section-title">
                      {g.projectId ? (
                        <Link to={`/app/projetos/${g.projectId}`} className="hover:underline">
                          {g.name}
                        </Link>
                      ) : (
                        g.name
                      )}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {g.rows.length} acesso{g.rows.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <AccessList rows={g.rows} hideProject />
                </section>
              ))}
            </div>
          ) : (
            <AccessList rows={q.data.rows} hideProject={Boolean(projectId) && projectId !== NO_PROJECT} />
          )}
        </>
      )}
    </>
  )
}
