import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { FilterBar } from '@/components/FilterBar'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateProduct, useProduct, useProducts, useUpdateProduct, type StatusFilter } from './api'
import { ProductForm } from './ProductForm'
import { ProspectingNav } from './ProspectingNav'
import { outreachErrorMessage } from './schema'

export function ProductsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const q = useProducts({ search, status }, Boolean(orgId))
  const filtered = Boolean(search) || status !== 'active'

  return (
    <>
      <PageHeader
        title="Sistemas"
        description="O que você vende. Cada sistema alimenta {{sistema}}, {{proposta}} e {{demo}} nos modelos de mensagem."
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/prospeccao/sistemas/novo">Novo sistema</Link>
            </Button>
          )
        }
      />
      <ProspectingNav />
      <FilterBar
        className="md:grid-cols-[minmax(0,1fr)_14rem]"
        activeCount={status !== 'active' ? 1 : 0}
        search={
          <input aria-label="Buscar sistemas" placeholder="Buscar por nome, proposta ou público" className={controlClass} value={search} onChange={(e) => setSearch(e.target.value)} />
        }
      >
        <select aria-label="Situação" className={controlClass} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="all">Todos</option>
        </select>
      </FilterBar>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os sistemas." onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.length === 0 && (
        <EmptyState
          title="Nenhum sistema encontrado"
          description={filtered ? 'Ajuste os filtros.' : 'Cadastre o primeiro sistema que você vende: nome e uma frase de proposta de valor.'}
          action={
            canWrite && !filtered ? (
              <Button asChild>
                <Link to="/app/prospeccao/sistemas/novo">Novo sistema</Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {q.isSuccess && q.data.length > 0 && (
        <ul className="plate divide-y divide-border">
          {q.data.map((p) => (
            <li key={p.id}>
              <Link to={`/app/prospeccao/sistemas/${p.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/60 sm:px-5">
                <span className="min-w-0">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">{p.value_proposition || p.audience || 'Sem proposta de valor'}</span>
                </span>
                {!p.active && <StatusBadge>Inativo</StatusBadge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function ProductNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateProduct(orgId)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (!canWrite) return <p role="alert">Você não tem permissão para criar sistemas.</p>
  return (
    <EntityView
      kind="Sistema"
      title="Novo sistema"
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <ProductForm
              submitLabel="Criar sistema"
              serverError={error}
              onSubmit={async (values) => {
                setError(null)
                try {
                  const created = await create.mutateAsync(values)
                  navigate(`/app/prospeccao/sistemas/${created.id}`, { replace: true })
                } catch (e) {
                  setError(outreachErrorMessage(e))
                }
              }}
            />
          ),
        },
      ]}
    />
  )
}

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useProduct(id)
  const update = useUpdateProduct(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o sistema." onRetry={() => q.refetch()} />
  const p = q.data
  if (!p) return <ErrorState message="Sistema não encontrado." />
  return (
    <EntityView
      kind="Sistema"
      title={p.name}
      description={p.active ? undefined : 'Inativo'}
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <>
              {message && (
                <p role="status" className="text-sm text-tone-success">
                  {message}
                </p>
              )}
              <ProductForm
                key={p.updated_at}
                initial={{
                  name: p.name,
                  description: p.description ?? '',
                  value_proposition: p.value_proposition ?? '',
                  audience: p.audience ?? '',
                  demo_url: p.demo_url ?? '',
                  price_note: p.price_note ?? '',
                  active: p.active,
                }}
                readOnly={!canWrite}
                submitLabel="Salvar alterações"
                serverError={error}
                onSubmit={async (values) => {
                  setError(null)
                  setMessage(null)
                  try {
                    await update.mutateAsync(values)
                    setMessage('Alterações salvas.')
                  } catch (e) {
                    setError(outreachErrorMessage(e))
                  }
                }}
              />
            </>
          ),
        },
      ]}
    />
  )
}
