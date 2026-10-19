import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { objectValidator, usePersistedState } from '@/lib/usePersistedState'
import { PAGE_SIZE, useLeads, type ArchivedFilter, type LeadListParams } from './api'
import { stages, temperatures, type Stage, type Temperature } from './schema'
import { TemperatureBadge } from './TemperatureBadge'

type Remembered = Pick<LeadListParams, 'temperature' | 'stage' | 'archived'>
const DEFAULTS: Remembered = { temperature: '', stage: '', archived: 'active' }
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (values as readonly string[]).includes(v)
const validate = objectValidator(DEFAULTS, {
  temperature: oneOf(['', 'cold', 'warm', 'hot'] as const),
  stage: oneOf(['', 'new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'] as const),
  archived: oneOf(['active', 'archived', 'all'] as const),
})

export function LeadsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [remembered, setRemembered] = usePersistedState('projecthub:leads-view', DEFAULTS, validate)
  const [view, setView] = useState({ search: '', page: 0 })
  const params: LeadListParams = { ...remembered, ...view }
  const q = useLeads(params, Boolean(orgId))
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const filtered = Boolean(params.search || params.temperature || params.stage || params.archived !== 'active')

  const setFilter = (patch: Partial<Remembered>) => {
    setRemembered((r) => ({ ...r, ...patch }))
    setView((v) => ({ ...v, page: 0 }))
  }

  return (
    <>
      <PageHeader
        title="Prospecção"
        description="Leads para divulgar seus sistemas. Lead frio só por e-mail; WhatsApp a partir de morno."
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/prospeccao/leads/novo">Novo lead</Link>
            </Button>
          )
        }
      />

      <FilterBar
        className="md:grid-cols-[minmax(0,1fr)_11rem_11rem_12rem]"
        activeCount={(params.temperature ? 1 : 0) + (params.stage ? 1 : 0) + (params.archived !== 'active' ? 1 : 0)}
        search={
          <input
            aria-label="Buscar leads"
            placeholder="Buscar por empresa, contato, e-mail, cidade ou segmento"
            className={controlClass}
            value={params.search}
            onChange={(e) => setView({ search: e.target.value, page: 0 })}
          />
        }
      >
        <select
          aria-label="Temperatura"
          className={controlClass}
          value={params.temperature}
          onChange={(e) => setFilter({ temperature: e.target.value as '' | Temperature })}
        >
          <option value="">Todas as temperaturas</option>
          {Object.entries(temperatures).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Etapa"
          className={controlClass}
          value={params.stage}
          onChange={(e) => setFilter({ stage: e.target.value as '' | Stage })}
        >
          <option value="">Todas as etapas</option>
          {Object.entries(stages).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Arquivamento"
          className={controlClass}
          value={params.archived}
          onChange={(e) => setFilter({ archived: e.target.value as ArchivedFilter })}
        >
          <option value="active">Não arquivados</option>
          <option value="archived">Arquivados</option>
          <option value="all">Todos</option>
        </select>
      </FilterBar>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os leads." onRetry={() => q.refetch()} />}
      {q.isSuccess && count === 0 && (
        <EmptyState
          title="Nenhum lead encontrado"
          description={filtered ? 'Ajuste os filtros.' : 'Cadastre o primeiro lead. A importação de planilhas chega na próxima etapa.'}
          action={
            canWrite && !filtered ? (
              <Button asChild>
                <Link to="/app/prospeccao/leads/novo">Novo lead</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {q.isSuccess && count > 0 && (
        <>
          <ul className="plate divide-y divide-border">
            {q.data.rows.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/app/prospeccao/leads/${l.id}`}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/60 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{l.company_name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[l.contact_name, [l.city, l.state].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Sem contato'}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {l.next_contact_on && (
                      <span className="text-sm text-muted-foreground tabular-nums">Contato {formatDate(l.next_contact_on)}</span>
                    )}
                    {l.opted_out_at && <StatusBadge>Não contatar</StatusBadge>}
                    {l.archived_at && <StatusBadge>Arquivado</StatusBadge>}
                    <StatusBadge>{stages[l.stage as Stage] ?? l.stage}</StatusBadge>
                    <TemperatureBadge value={l.temperature} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {count} lead{count === 1 ? '' : 's'} · página {params.page + 1} de {pages}
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
