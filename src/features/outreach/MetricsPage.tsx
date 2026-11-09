import { useMemo } from 'react'
import { Plate } from '@/components/Plate'
import { ErrorState, LoadingState, PageHeader } from '@/components/states'
import { stages } from '@/features/leads/schema'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { todayISO } from '@/lib/format'
import { useMetricsData } from './api'
import { convertedSince, percent, replyRates, stageCounts, type Dimension, type RateRow } from './metrics'
import { ProspectingNav } from './ProspectingNav'

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="plate p-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="block text-[1.75rem] leading-8 font-bold tracking-[-0.02em] tabular-nums">{value}</span>
        {note && <span className="mt-1 block text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  )
}

function RateTable({ id, title, rows }: { id: string; title: string; rows: RateRow[] }) {
  return (
    <Plate id={id} title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem mensagens enviadas ainda.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-xs font-semibold text-muted-foreground">
              <th scope="col" className="pb-2">Grupo</th>
              <th scope="col" className="pb-2 text-right">Contatados</th>
              <th scope="col" className="pb-2 text-right">Responderam</th>
              <th scope="col" className="pb-2 text-right">Taxa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <th scope="row" className="py-2 text-left font-medium">{r.label}</th>
                <td className="py-2 text-right tabular-nums">{r.contacted}</td>
                <td className="py-2 text-right tabular-nums">{r.replied}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{percent(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Plate>
  )
}

export function MetricsPage() {
  const { orgId } = useCurrentWorkspace()
  const q = useMetricsData(Boolean(orgId))
  const data = q.data
  const monthStart = `${todayISO().slice(0, 7)}-01`

  const view = useMemo(() => {
    if (!data) return null
    const rate = (d: Dimension) => replyRates(data.sent, data.replies, d)
    const overall = replyRates(data.sent.map((s) => ({ ...s, channel: 'all' })), data.replies, 'channel')[0]
    return {
      funnel: stageCounts(data.leads),
      converted: convertedSince(data.leads, monthStart),
      overall,
      byCampaign: rate('campaign'),
      byTemplate: rate('template'),
      byChannel: rate('channel'),
      byTemperature: rate('temperature'),
    }
  }, [data, monthStart])

  const maxCount = Math.max(1, ...(view?.funnel.map((f) => f.count) ?? [1]))

  return (
    <>
      <PageHeader title="Métricas" description="Como a prospecção está andando. Conta como enviada a mensagem com status Enviada." />
      <ProspectingNav />
      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as métricas." onRetry={() => q.refetch()} />}
      {data && view && (
        <>
          <dl aria-label="Resumo" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Leads ativos" value={String(data.leads.length)} />
            <Kpi label="Taxa de resposta" value={view.overall ? percent(view.overall.rate) : '—'} note={view.overall ? `${view.overall.replied} de ${view.overall.contacted} contatados` : 'Sem envios ainda'} />
            <Kpi label="Convertidos no mês" value={String(view.converted)} />
            <Kpi label="Na fila" value={String(data.queued)} note="rascunhos e aprovadas" />
          </dl>

          <Plate id="funnel-h" title="Leads por etapa">
            <ul className="space-y-2">
              {view.funnel.map((f) => (
                <li key={f.stage} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="font-medium">{stages[f.stage as keyof typeof stages] ?? f.stage}</span>
                  <progress className="h-2 w-full overflow-hidden rounded-full accent-[var(--primary)]" max={maxCount} value={f.count} aria-label={`${stages[f.stage as keyof typeof stages] ?? f.stage}: ${f.count}`} />
                  <span className="text-right tabular-nums">{f.count}</span>
                </li>
              ))}
            </ul>
          </Plate>

          <div className="grid gap-6 lg:grid-cols-2">
            <RateTable id="rate-campaign-h" title="Taxa de resposta por campanha" rows={view.byCampaign} />
            <RateTable id="rate-template-h" title="Taxa de resposta por modelo" rows={view.byTemplate} />
            <RateTable id="rate-channel-h" title="Taxa de resposta por canal" rows={view.byChannel} />
            <RateTable id="rate-temp-h" title="Taxa de resposta por temperatura" rows={view.byTemperature} />
          </div>
        </>
      )}
    </>
  )
}
