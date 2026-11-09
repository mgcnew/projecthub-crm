import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { FilterBar } from '@/components/FilterBar'
import { Plate } from '@/components/Plate'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useInbox, useLeadSamples, useMarkRead, useRegisterReply, useUnreadInboundCount, type InboxFilter } from './api'
import { ProspectingNav } from './ProspectingNav'
import { channels, type Channel } from './schema'

/** Respostas dos leads. O e-mail é registrado à mão (até o Workspace); o WhatsApp chega pelo webhook (7.6). */
export function InboxPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const enabled = Boolean(orgId)
  const [filter, setFilter] = useState<InboxFilter>('unread')
  const [registering, setRegistering] = useState(false)
  const q = useInbox(filter, enabled)
  const unread = useUnreadInboundCount(enabled).data ?? 0
  const mark = useMarkRead()
  const rows = q.data ?? []
  const unreadIds = rows.filter((r) => !r.read_at).map((r) => r.id)

  return (
    <>
      <PageHeader
        title="Respostas"
        description="O que os leads responderam. Responder muda a etapa e a temperatura do lead e para a sequência da campanha."
        actions={
          canWrite && (
            <Button onClick={() => setRegistering((r) => !r)} aria-expanded={registering}>
              Registrar resposta
            </Button>
          )
        }
      />
      <ProspectingNav />
      {registering && <RegisterReply onClose={() => setRegistering(false)} />}

      <FilterBar className="md:grid-cols-[16rem]" activeCount={filter !== 'unread' ? 1 : 0} search={<span />}>
        <select aria-label="Situação" className={controlClass} value={filter} onChange={(e) => setFilter(e.target.value as InboxFilter)}>
          <option value="unread">Novas ({unread})</option>
          <option value="all">Todas</option>
        </select>
      </FilterBar>

      {canWrite && unreadIds.length > 0 && (
        <div>
          <Button variant="outline" size="sm" disabled={mark.isPending} onClick={() => mark.mutate(unreadIds)}>
            Marcar {unreadIds.length} como lida{unreadIds.length === 1 ? '' : 's'}
          </Button>
        </div>
      )}

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as respostas." onRetry={() => q.refetch()} />}
      {q.isSuccess && rows.length === 0 && (
        <EmptyState
          title={filter === 'unread' ? 'Nenhuma resposta nova' : 'Nenhuma resposta ainda'}
          description="Quando um lead responder, a mensagem aparece aqui. Respostas por e-mail você registra à mão."
        />
      )}
      {q.isSuccess && rows.length > 0 && (
        <ul className="plate divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  {r.lead_id ? (
                    <Link to={`/app/prospeccao/leads/${r.lead_id}?aba=conversa`} className="font-semibold hover:underline">
                      {r.leads?.company_name ?? 'Lead'}
                    </Link>
                  ) : (
                    <span className="font-semibold">{r.from_address}</span>
                  )}
                  <StatusBadge tone="info">{channels[r.channel as Channel]}</StatusBadge>
                  {!r.lead_id && <StatusBadge tone="warning">Sem lead</StatusBadge>}
                  {!r.read_at && <StatusBadge tone="success">Nova</StatusBadge>}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{r.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(r.received_at)}</p>
              </div>
              {canWrite && !r.read_at && (
                <Button size="sm" variant="outline" disabled={mark.isPending} onClick={() => mark.mutate([r.id])}>
                  Marcar como lida
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function RegisterReply({ onClose }: { onClose: () => void }) {
  const { orgId } = useCurrentWorkspace()
  const leads = useLeadSamples(true)
  const register = useRegisterReply(orgId)
  const [leadId, setLeadId] = useState('')
  const [channel, setChannel] = useState<Channel>('email')
  const [body, setBody] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!leadId || !body.trim()) {
      setError('Escolha o lead e escreva a resposta.')
      return
    }
    try {
      await register.mutateAsync({ leadId, channel, body: body.trim() })
      setBody('')
      setMessage('Resposta registrada. A etapa do lead e a sequência da campanha foram atualizadas.')
    } catch {
      setError('Não foi possível registrar a resposta.')
    }
  }

  return (
    <Plate id="reply-h" title="Registrar resposta" action={<Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>}>
      <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
        <Field id="reply-lead" label="Lead">
          <select id="reply-lead" className={controlClass} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Escolha…</option>
            {(leads.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.company_name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="reply-channel" label="Canal">
          <select id="reply-channel" className={controlClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {Object.entries(channels).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="reply-body" label="O que o lead respondeu" hint='Se ele escreveu "SAIR", o lead vai para "não contatar".'>
          <textarea id="reply-body" className={textareaClass} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Registrando…' : 'Registrar'}
        </Button>
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
      </form>
    </Plate>
  )
}
