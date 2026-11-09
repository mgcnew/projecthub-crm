import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { FilterBar } from '@/components/FilterBar'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { TemperatureBadge } from '@/features/leads/TemperatureBadge'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateTemplate, useTemplate, useTemplates, useUpdateTemplate, type StatusFilter, type TemplateListParams } from './api'
import { ProspectingNav } from './ProspectingNav'
import { channels, outreachErrorMessage, stepLabels, type Channel } from './schema'
import { TemplateForm } from './TemplateForm'

export function TemplatesPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [params, setParams] = useState<TemplateListParams>({ channel: '', step: '', status: 'active' })
  const q = useTemplates(params, Boolean(orgId))
  const filtered = params.channel !== '' || params.step !== '' || params.status !== 'active'
  const set = (patch: Partial<TemplateListParams>) => setParams((p) => ({ ...p, ...patch }))

  return (
    <>
      <PageHeader
        title="Modelos"
        description="Mensagens por sistema, canal e passo, com variações de abertura e fechamento para não soar repetido."
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/prospeccao/modelos/novo">Novo modelo</Link>
            </Button>
          )
        }
      />
      <ProspectingNav />
      <FilterBar className="md:grid-cols-[14rem_14rem_14rem]" activeCount={(params.channel ? 1 : 0) + (params.step ? 1 : 0) + (params.status !== 'active' ? 1 : 0)} search={<span />}>
        <select aria-label="Canal" className={controlClass} value={params.channel} onChange={(e) => set({ channel: e.target.value as '' | Channel })}>
          <option value="">Todos os canais</option>
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select aria-label="Passo" className={controlClass} value={params.step} onChange={(e) => set({ step: e.target.value as TemplateListParams['step'] })}>
          <option value="">Todos os passos</option>
          {Object.entries(stepLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="Situação" className={controlClass} value={params.status} onChange={(e) => set({ status: e.target.value as StatusFilter })}>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="all">Todos</option>
        </select>
      </FilterBar>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os modelos." onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.length === 0 && (
        <EmptyState
          title="Nenhum modelo encontrado"
          description={filtered ? 'Ajuste os filtros.' : 'Crie o primeiro modelo: a mensagem do primeiro contato com os leads.'}
          action={
            canWrite && !filtered ? (
              <Button asChild>
                <Link to="/app/prospeccao/modelos/novo">Novo modelo</Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {q.isSuccess && q.data.length > 0 && (
        <ul className="plate divide-y divide-border">
          {q.data.map((t) => (
            <li key={t.id}>
              <Link to={`/app/prospeccao/modelos/${t.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/60 sm:px-5">
                <span className="min-w-0">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{t.subject ?? t.body}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {!t.active && <StatusBadge>Inativo</StatusBadge>}
                  {t.products?.name && <span className="text-sm text-muted-foreground">{t.products.name}</span>}
                  <StatusBadge tone="info">{channels[t.channel as Channel] ?? t.channel}</StatusBadge>
                  <StatusBadge>{stepLabels[t.step as 1 | 2 | 3] ?? `Passo ${t.step}`}</StatusBadge>
                  {t.temperature && <TemperatureBadge value={t.temperature} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function TemplateNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateTemplate(orgId)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (!canWrite) return <p role="alert">Você não tem permissão para criar modelos.</p>
  return (
    <EntityView
      kind="Modelo"
      title="Novo modelo"
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <TemplateForm
              templateId="novo"
              submitLabel="Criar modelo"
              serverError={error}
              onSubmit={async (values) => {
                setError(null)
                try {
                  const created = await create.mutateAsync(values)
                  navigate(`/app/prospeccao/modelos/${created.id}`, { replace: true })
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

export function TemplateDetailPage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useTemplate(id)
  const update = useUpdateTemplate(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o modelo." onRetry={() => q.refetch()} />
  const t = q.data
  if (!t) return <ErrorState message="Modelo não encontrado." />
  return (
    <EntityView
      kind="Modelo"
      title={t.name}
      description={`${channels[t.channel as Channel] ?? t.channel} · ${stepLabels[t.step as 1 | 2 | 3] ?? `Passo ${t.step}`}`}
      tabs={[
        {
          id: 'dados',
          label: 'Modelo',
          content: (
            <>
              {message && (
                <p role="status" className="text-sm text-tone-success">
                  {message}
                </p>
              )}
              <TemplateForm
                key={t.updated_at}
                templateId={t.id}
                initial={{
                  name: t.name,
                  product_id: t.product_id ?? '',
                  channel: t.channel as Channel,
                  temperature: (t.temperature ?? '') as '' | 'cold' | 'warm' | 'hot',
                  step: String(t.step) as '1' | '2' | '3',
                  subject: t.subject ?? '',
                  body: t.body,
                  openings: t.openings.join('\n'),
                  closings: t.closings.join('\n'),
                  active: t.active,
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
