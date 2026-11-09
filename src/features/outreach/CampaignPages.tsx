import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { TemperatureBadge } from '@/features/leads/TemperatureBadge'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { dayStartInstant, formatDate, todayISO } from '@/lib/format'
import {
  useCampaign,
  useCampaignLeads,
  useCampaignTemplates,
  useCampaigns,
  useCreateCampaign,
  useCreateCampaignDrafts,
  useGeneratedToday,
  useProductOptions,
  useUpdateCampaign,
  type CampaignDraftInput,
} from './api'
import { CampaignForm } from './CampaignForm'
import { CampaignLeads } from './CampaignLeads'
import { ProspectingNav } from './ProspectingNav'
import { pendingCampaignRows } from './queue'
import { renderMessage } from './render'
import { campaignPayload, campaignStatusLabels, channels, outreachErrorMessage, type CampaignFormValues, type Channel } from './schema'

const statusTone = { draft: 'neutral', active: 'success', paused: 'warning', finished: 'neutral' } as const

export function CampaignsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useCampaigns(Boolean(orgId))
  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Público + sistema + canal + sequência (1ª mensagem e lembretes). A campanha só gera rascunhos: nada sai sem a sua aprovação."
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/prospeccao/campanhas/novo">Nova campanha</Link>
            </Button>
          )
        }
      />
      <ProspectingNav />
      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as campanhas." onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.length === 0 && (
        <EmptyState
          title="Nenhuma campanha ainda"
          description="Crie uma campanha, escolha os modelos de cada passo e inclua os leads."
          action={
            canWrite ? (
              <Button asChild>
                <Link to="/app/prospeccao/campanhas/novo">Nova campanha</Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {q.isSuccess && q.data.length > 0 && (
        <ul className="plate divide-y divide-border">
          {q.data.map((c) => {
            const active = c.campaign_leads.filter((l) => l.status === 'active').length
            return (
              <li key={c.id}>
                <Link to={`/app/prospeccao/campanhas/${c.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/60 sm:px-5">
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.products?.name ?? 'Sistema do lead'} · {c.campaign_leads.length} lead{c.campaign_leads.length === 1 ? '' : 's'} ({active} na sequência)
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{channels[c.channel as Channel]}</StatusBadge>
                    {c.temperature && <TemperatureBadge value={c.temperature} />}
                    <StatusBadge tone={statusTone[c.status as keyof typeof statusTone]}>{campaignStatusLabels[c.status as keyof typeof campaignStatusLabels]}</StatusBadge>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export function CampaignNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateCampaign(orgId)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (!canWrite) return <p role="alert">Você não tem permissão para criar campanhas.</p>
  return (
    <EntityView
      kind="Campanha"
      title="Nova campanha"
      tabs={[
        {
          id: 'dados',
          label: 'Campanha',
          content: (
            <CampaignForm
              submitLabel="Criar campanha"
              serverError={error}
              onSubmit={async (values) => {
                setError(null)
                try {
                  const created = await create.mutateAsync(values)
                  navigate(`/app/prospeccao/campanhas/${created.id}`, { replace: true })
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

export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useCampaign(id)
  const update = useUpdateCampaign(id)
  const leadsQ = useCampaignLeads(id)
  const products = useProductOptions(true)
  const createDrafts = useCreateCampaignDrafts(orgId, id)
  const c = q.data
  const templates = useCampaignTemplates([c?.step1_template_id ?? '', c?.step2_template_id ?? '', c?.step3_template_id ?? ''])
  const today = todayISO()
  const generatedToday = useGeneratedToday(id, dayStartInstant(today)).data ?? 0
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const max = c ? 1 + c.followup_days.length : 1
  const stepTemplate = (step: number) => {
    const tid = step === 1 ? c?.step1_template_id : step === 2 ? c?.step2_template_id : c?.step3_template_id
    return templates.data?.find((t) => t.id === tid) ?? null
  }

  // Quem espera um rascunho: passo 1 ainda não gerado, ou lembrete vencido.
  const pending = useMemo(() => pendingCampaignRows(leadsQ.data ?? [], max, today), [leadsQ.data, max, today])

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar a campanha." onRetry={() => q.refetch()} />
  if (!c) return <ErrorState message="Campanha não encontrada." />

  const generate = async (rows: { lead_id: string; step: number; leads: { company_name: string; contact_name: string | null; hook: string | null; product_id: string | null } | null }[]) => {
    setError(null)
    setMessage(null)
    if (c.status !== 'active') {
      setError('Ative a campanha para gerar rascunhos.')
      return
    }
    const remaining = Math.max(0, c.daily_limit - generatedToday)
    if (remaining === 0) {
      setError(`O limite de ${c.daily_limit} rascunhos por dia desta campanha já foi usado hoje.`)
      return
    }
    const drafts: CampaignDraftInput[] = []
    for (const r of rows.slice(0, remaining)) {
      const step = r.step + 1
      const t = stepTemplate(step)
      if (!t || !r.leads) continue
      const productId = c.product_id ?? r.leads.product_id
      const p = products.data?.find((x) => x.id === productId) ?? null
      const out = renderMessage({
        template: { id: t.id, step: t.step, subject: t.subject, body: t.body, openings: t.openings, closings: t.closings },
        lead: { id: r.lead_id, company_name: r.leads.company_name, contact_name: r.leads.contact_name, hook: r.leads.hook },
        product: p ? { name: p.name, value_proposition: p.value_proposition, demo_url: p.demo_url } : null,
      })
      drafts.push({ leadId: r.lead_id, templateId: t.id, channel: c.channel as Channel, subject: out.subject, body: out.body })
    }
    if (drafts.length === 0) {
      setError('Nenhum lead com modelo configurado para o próximo passo.')
      return
    }
    try {
      const res = await createDrafts.mutateAsync(drafts)
      const cut = rows.length - drafts.length
      setMessage(
        `${res.created} rascunho${res.created === 1 ? '' : 's'} gerado${res.created === 1 ? '' : 's'} na fila${res.blocked ? `; ${res.blocked} barrado${res.blocked === 1 ? '' : 's'} pelo banco` : ''}${cut > 0 ? `; ${cut} ficaram para amanhã (limite diário)` : ''}.`,
      )
    } catch {
      setError('Não foi possível gerar os rascunhos.')
    }
  }

  const setStatus = async (status: 'active' | 'paused' | 'finished', done: string) => {
    setError(null)
    setMessage(null)
    try {
      await update.mutateAsync({ status })
      setMessage(done)
    } catch (e) {
      setError(outreachErrorMessage(e))
    }
  }

  const statusButtons = canWrite && (
    <>
      {(c.status === 'draft' || c.status === 'paused') && (
        <Button disabled={update.isPending || !c.step1_template_id} onClick={() => setStatus('active', 'Campanha ativa.')}>
          {c.status === 'paused' ? 'Retomar' : 'Ativar'}
        </Button>
      )}
      {c.status === 'active' && (
        <Button variant="outline" disabled={update.isPending} onClick={() => setStatus('paused', 'Campanha pausada: não gera rascunhos.')}>
          Pausar
        </Button>
      )}
      {c.status !== 'finished' && (
        <Button variant="outline" disabled={update.isPending} onClick={() => setStatus('finished', 'Campanha encerrada.')}>
          Encerrar
        </Button>
      )}
    </>
  )

  const notices = (
    <>
      {message && (
        <p role="status" className="text-sm text-tone-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  )

  const form = (
    <>
      {notices}
      <CampaignForm
        key={c.updated_at}
        lockPublic
        initial={{
          name: c.name,
          product_id: c.product_id ?? '',
          channel: c.channel as Channel,
          temperature: (c.temperature ?? '') as '' | 'cold' | 'warm' | 'hot',
          daily_limit: String(c.daily_limit),
          followup_1: c.followup_days[0]?.toString() ?? '',
          followup_2: c.followup_days[1]?.toString() ?? '',
          step1_template_id: c.step1_template_id ?? '',
          step2_template_id: c.step2_template_id ?? '',
          step3_template_id: c.step3_template_id ?? '',
        }}
        readOnly={!canWrite || c.status === 'finished'}
        submitLabel="Salvar alterações"
        onSubmit={async (values: CampaignFormValues) => {
          setError(null)
          setMessage(null)
          try {
            await update.mutateAsync(campaignPayload(values))
            setMessage('Alterações salvas.')
          } catch (e) {
            setError(outreachErrorMessage(e))
          }
        }}
      />
    </>
  )

  return (
    <EntityView
      kind="Campanha"
      title={c.name}
      description={`${channels[c.channel as Channel]} · ${campaignStatusLabels[c.status as keyof typeof campaignStatusLabels]}`}
      actions={statusButtons}
      tabs={[
        { id: 'dados', label: 'Campanha', content: form },
        {
          id: 'leads',
          label: 'Leads',
          badge: leadsQ.data?.length ?? undefined,
          content: (
            <>
              {notices}
              <CampaignLeads
                campaign={c}
              onGenerateStep1={async (ids) => {
                const rows = (await leadsQ.refetch()).data?.filter((r) => ids.includes(r.lead_id) && r.step === 0) ?? []
                await generate(rows)
              }}
              />
            </>
          ),
        },
        {
          id: 'lembretes',
          label: 'Rascunhos a gerar',
          badge: pending.length || undefined,
          content: (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Leads esperando o próximo passo: o passo 1 ainda não gerado ou um lembrete que venceu. Gerar cria <strong className="text-foreground">rascunhos</strong> na
                fila; nada é enviado. Hoje: {generatedToday} de {c.daily_limit} rascunhos.
              </p>
              {notices}
              {pending.length === 0 ? (
                <EmptyState title="Nada a gerar agora" description="Quando um lembrete vencer, ele aparece aqui (e na Central do dia)." />
              ) : (
                <>
                  <ul className="plate divide-y divide-border">
                    {pending.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span className="font-semibold">{r.leads?.company_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {r.step === 0 ? 'Passo 1' : `Lembrete do passo ${r.step + 1}${r.next_step_on ? ` · venceu ${formatDate(r.next_step_on)}` : ''}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <Button disabled={createDrafts.isPending || c.status !== 'active'} onClick={() => generate(pending)}>
                      {createDrafts.isPending ? 'Gerando…' : `Gerar ${pending.length} rascunho${pending.length === 1 ? '' : 's'}`}
                    </Button>
                  )}
                  {c.status !== 'active' && <p className="text-sm text-muted-foreground">Ative a campanha para gerar rascunhos.</p>}
                </>
              )}
            </div>
          ),
        },
      ]}
    />
  )
}
