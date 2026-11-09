import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar } from '@/components/FilterBar'
import { controlClass } from '@/components/form-styles'
import { RowCheckbox } from '@/components/RowCheckbox'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useOutbox, useOutboxCounts, useSetStatusMany, type OutboxStatus } from './api'
import { GenerateDrafts } from './GenerateDrafts'
import { ProspectingNav } from './ProspectingNav'
import { channels, stepLabels, type Channel } from './schema'

const statusLabel = { draft: 'Rascunho', approved: 'Aprovada', cancelled: 'Cancelada', sending: 'Enviando', sent: 'Enviada', failed: 'Falhou' } as const
const statusTone = { draft: 'warning', approved: 'success', cancelled: 'neutral', sending: 'info', sent: 'success', failed: 'danger' } as const

export function OutboxPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const enabled = Boolean(orgId)
  const [status, setStatus] = useState<OutboxStatus>('draft')
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const q = useOutbox(status, enabled)
  const counts = useOutboxCounts(enabled).data
  const bulk = useSetStatusMany()
  const rows = q.data ?? []
  const ids = rows.map((r) => r.id)
  const chosen = ids.filter((id) => selected.has(id))
  const allChosen = ids.length > 0 && chosen.length === ids.length

  const run = async (target: 'approved' | 'cancelled' | 'draft', verb: string) => {
    setMessage(null)
    const res = await bulk.mutateAsync({ ids: chosen, status: target })
    setSelected(new Set())
    setMessage(`${res.done} ${res.done === 1 ? 'mensagem' : 'mensagens'} ${verb}${res.failed ? `; ${res.failed} barrada${res.failed === 1 ? '' : 's'} pelo banco (lead saiu da lista ou está na supressão)` : ''}.`)
  }

  return (
    <>
      <PageHeader
        title="Fila"
        description="Rascunhos para revisar, editar e aprovar. Nada é enviado nesta etapa."
        actions={
          canWrite && (
            <Button onClick={() => setGenerating((g) => !g)} aria-expanded={generating}>
              Gerar rascunhos
            </Button>
          )
        }
      />
      <ProspectingNav />
      {generating && <GenerateDrafts onClose={() => setGenerating(false)} />}

      <FilterBar className="md:grid-cols-[16rem]" activeCount={status !== 'draft' ? 1 : 0} search={<span />}>
        <select
          aria-label="Situação"
          className={controlClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OutboxStatus)
            setSelected(new Set())
          }}
        >
          <option value="draft">Rascunhos{counts ? ` (${counts.draft})` : ''}</option>
          <option value="approved">Aprovadas{counts ? ` (${counts.approved})` : ''}</option>
          <option value="sent">Enviadas</option>
          <option value="failed">Falhas{counts && counts.failed > 0 ? ` (${counts.failed})` : ''}</option>
          <option value="cancelled">Canceladas</option>
          <option value="all">Todas</option>
        </select>
      </FilterBar>

      {canWrite && chosen.length > 0 && (
        <div role="region" aria-label="Ações em lote" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-card">
          <span className="text-sm font-semibold tabular-nums">{chosen.length} selecionada{chosen.length === 1 ? '' : 's'}</span>
          {status === 'draft' && (
            <Button size="sm" disabled={bulk.isPending} onClick={() => run('approved', 'aprovada(s)')}>
              Aprovar selecionadas
            </Button>
          )}
          {(status === 'approved' || status === 'failed') && (
            <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => run('draft', 'devolvida(s) para rascunho')}>
              Voltar para rascunho
            </Button>
          )}
          {(status === 'draft' || status === 'approved') && (
            <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => run('cancelled', 'cancelada(s)')}>
              Cancelar selecionadas
            </Button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-tone-success">
          {message}
        </p>
      )}

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar a fila." onRetry={() => q.refetch()} />}
      {q.isSuccess && rows.length === 0 && (
        <EmptyState
          title={status === 'draft' ? 'Nenhum rascunho para revisar' : 'Nada por aqui'}
          description={status === 'draft' ? 'Gere rascunhos a partir de um modelo: um por lead, com a variação de cada um.' : 'Troque a situação para ver outras mensagens.'}
          action={
            canWrite && status === 'draft' ? (
              <Button onClick={() => setGenerating(true)}>Gerar rascunhos</Button>
            ) : undefined
          }
        />
      )}
      {q.isSuccess && rows.length > 0 && (
        <>
          {canWrite && (status === 'draft' || status === 'approved' || status === 'failed') && (
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4"
                checked={allChosen}
                onChange={() => setSelected(allChosen ? new Set() : new Set(ids))}
              />
              Selecionar todas ({ids.length})
            </label>
          )}
          <ul className="plate divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-stretch">
                {canWrite && (status === 'draft' || status === 'approved' || status === 'failed') && (
                  <div className="flex items-center pl-2">
                    <RowCheckbox
                      label={`Selecionar mensagem para ${r.leads?.company_name ?? 'lead'}`}
                      checked={selected.has(r.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }
                    />
                  </div>
                )}
                <Link
                  to={`/app/prospeccao/fila/${r.id}`}
                  className="flex min-h-14 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.leads?.company_name ?? 'Lead'}</span>
                    <span className="block truncate text-sm text-muted-foreground">{r.subject ? `${r.subject} — ` : ''}{r.body}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.to_address}{r.sent_at ? ` · enviada em ${formatDateTime(r.sent_at)}` : ''}</span>
                    {r.status === 'failed' && r.last_error && <span className="block truncate text-xs text-destructive">{r.last_error}</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{channels[r.channel as Channel]}</StatusBadge>
                    {r.message_templates && <StatusBadge>{stepLabels[r.message_templates.step as 1 | 2 | 3]}</StatusBadge>}
                    <StatusBadge tone={statusTone[r.status as keyof typeof statusTone] ?? 'neutral'}>{statusLabel[r.status as keyof typeof statusLabel] ?? r.status}</StatusBadge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
