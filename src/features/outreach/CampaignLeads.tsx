import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plate } from '@/components/Plate'
import { RowCheckbox } from '@/components/RowCheckbox'
import { EmptyState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { useCampaignLeads, useIncludeLeads, useQueueLeads, useSetCampaignLeadStatus, useSuppressedValues } from './api'
import { splitEligible, skipLabels, type QueueLead, type SkipReason } from './queue'
import { campaignLeadStatusLabels, type Channel } from './schema'

type CampaignLite = { id: string; channel: string; temperature: string | null; followup_days: number[]; status: string }

const statusTone = { active: 'info', replied: 'success', finished: 'neutral', opted_out: 'warning', failed: 'danger' } as const

/** Leads da campanha: incluir (com os motivos de quem ficou de fora) e acompanhar a sequência de cada um. */
export function CampaignLeads({ campaign, onGenerateStep1 }: { campaign: CampaignLite; onGenerateStep1: (leadIds: string[]) => Promise<void> }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const rows = useCampaignLeads(campaign.id)
  const leads = useQueueLeads(true)
  const suppressed = useSuppressedValues(true)
  const include = useIncludeLeads(orgId, campaign.id)
  const setStatus = useSetCampaignLeadStatus()
  const [adding, setAdding] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const max = 1 + campaign.followup_days.length

  const inCampaign = useMemo(() => new Set((rows.data ?? []).map((r) => r.lead_id)), [rows.data])
  const split = useMemo(() => {
    if (!leads.data || !suppressed.data) return null
    return splitEligible({
      template: { channel: campaign.channel as Channel, temperature: campaign.temperature },
      leads: leads.data as QueueLead[],
      suppressed: suppressed.data,
      queued: inCampaign,
    })
  }, [leads.data, suppressed.data, inCampaign, campaign.channel, campaign.temperature])
  const chosen = split?.eligible.filter((l) => !excluded.has(l.id)) ?? []
  const reason = (r: SkipReason) => (r === 'ja-na-fila' ? 'já está na campanha' : skipLabels[r])

  const add = async (generate: boolean) => {
    setMessage(null)
    const ids = chosen.map((l) => l.id)
    const res = await include.mutateAsync(ids)
    setExcluded(new Set())
    let text = `${res.added} lead${res.added === 1 ? '' : 's'} incluído${res.added === 1 ? '' : 's'}${res.failed ? `; ${res.failed} barrado${res.failed === 1 ? '' : 's'} pelo banco` : ''}.`
    if (generate && res.added > 0) {
      await onGenerateStep1(ids)
      text += ' Rascunhos do passo 1 gerados na fila.'
    }
    setMessage(text)
  }

  return (
    <div className="space-y-4">
      {canWrite && campaign.status !== 'finished' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            Incluir leads
          </Button>
          {message && (
            <p role="status" className="text-sm text-tone-success">
              {message}
            </p>
          )}
        </div>
      )}

      {adding && (
        <Plate id="camp-add-h" title="Incluir leads" action={<Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Fechar</Button>}>
          {!split ? (
            <p className="text-sm text-muted-foreground">Carregando leads…</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{split.eligible.length}</strong> lead{split.eligible.length === 1 ? '' : 's'} pode{split.eligible.length === 1 ? '' : 'm'} entrar nesta campanha
                {split.skipped.size > 0 && <>. De fora: {[...split.skipped].map(([r, n]) => `${n} ${reason(r)}`).join('; ')}</>}.
              </p>
              {split.eligible.length > 0 && (
                <ul aria-label="Leads que podem entrar" className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {split.eligible.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 px-2">
                      <RowCheckbox
                        label={`Incluir ${l.company_name}`}
                        checked={!excluded.has(l.id)}
                        onChange={() =>
                          setExcluded((prev) => {
                            const next = new Set(prev)
                            if (next.has(l.id)) next.delete(l.id)
                            else next.add(l.id)
                            return next
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 py-2 text-sm font-semibold">{l.company_name}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={include.isPending || chosen.length === 0} onClick={() => add(false)}>
                  Incluir {chosen.length}
                </Button>
                <Button disabled={include.isPending || chosen.length === 0 || campaign.status !== 'active'} onClick={() => add(true)}>
                  Incluir e gerar rascunhos
                </Button>
                {campaign.status !== 'active' && <span className="self-center text-sm text-muted-foreground">Ative a campanha para gerar os rascunhos.</span>}
              </div>
            </div>
          )}
        </Plate>
      )}

      {rows.isPending && <LoadingState />}
      {rows.isSuccess && rows.data.length === 0 && <EmptyState title="Nenhum lead na campanha" description="Inclua leads para começar a sequência." />}
      {rows.isSuccess && rows.data.length > 0 && (
        <ul className="plate divide-y divide-border">
          {rows.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <span className="min-w-0">
                <Link to={`/app/prospeccao/leads/${r.lead_id}`} className="font-semibold hover:underline">
                  {r.leads?.company_name ?? 'Lead'}
                </Link>
                <span className="block text-sm text-muted-foreground">
                  {r.step === 0 ? 'Passo 1 ainda não gerado' : `Passo ${r.step} de ${max}`}
                  {r.next_step_on && r.status === 'active' ? ` · próximo lembrete em ${formatDate(r.next_step_on)}` : ''}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={statusTone[r.status as keyof typeof statusTone] ?? 'neutral'}>
                  {campaignLeadStatusLabels[r.status as keyof typeof campaignLeadStatusLabels] ?? r.status}
                </StatusBadge>
                {canWrite && r.status === 'active' && (
                  <>
                    <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: 'replied' })}>
                      Respondeu
                    </Button>
                    <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: 'finished' })}>
                      Encerrar
                    </Button>
                  </>
                )}
                {canWrite && r.status === 'replied' && (
                  <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: 'active' })}>
                    Retomar
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
