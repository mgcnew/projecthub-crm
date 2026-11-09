import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { EmptyState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useClientMatches, useConvertLead, useLeadTimeline, useRegisterReply } from './api'
import { channels, type Channel } from './schema'

type LeadLite = { id: string; company_name: string; email: string | null; converted_client_id: string | null; archived_at: string | null }

const outStatus = { draft: 'Rascunho', approved: 'Aprovada', cancelled: 'Cancelada', sending: 'Enviando', sent: 'Enviada', failed: 'Falhou' } as const

/** Conversa do lead (enviadas e respostas), registro de resposta e conversão em cliente. */
export function LeadConversation({ lead }: { lead: LeadLite }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const timeline = useLeadTimeline(lead.id)
  const register = useRegisterReply(orgId)
  const [channel, setChannel] = useState<Channel>('email')
  const [body, setBody] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = useMemo(() => {
    const t = timeline.data
    if (!t) return []
    return [
      ...t.outbound.map((m) => ({ kind: 'out' as const, id: m.id, at: m.sent_at ?? m.created_at, channel: m.channel, text: [m.subject, m.body].filter(Boolean).join(' — '), status: m.status })),
      ...t.inbound.map((m) => ({ kind: 'in' as const, id: m.id, at: m.received_at, channel: m.channel, text: m.body, status: m.read_at ? 'read' : 'new' })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [timeline.data])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!body.trim()) return
    try {
      await register.mutateAsync({ leadId: lead.id, channel, body: body.trim() })
      setBody('')
      setMessage('Resposta registrada.')
    } catch {
      setError('Não foi possível registrar a resposta.')
    }
  }

  return (
    <div className="space-y-6">
      <ConvertToClient lead={lead} canWrite={canWrite} />

      {canWrite && !lead.archived_at && (
        <Plate id="conv-reply-h" title="Registrar resposta">
          <form onSubmit={submit} noValidate className="max-w-xl space-y-3">
            <Field id="conv-channel" label="Canal">
              <select id="conv-channel" className={controlClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {Object.entries(channels).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="conv-body" label="O que o lead respondeu">
              <textarea id="conv-body" className={textareaClass} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Button type="submit" disabled={register.isPending || !body.trim()}>
              Registrar resposta
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
      )}

      <Plate id="conv-h" title="Conversa">
        {timeline.isPending && <LoadingState />}
        {timeline.isSuccess && items.length === 0 && <EmptyState title="Nada por aqui" description="As mensagens enviadas e as respostas deste lead aparecem aqui." />}
        {items.length > 0 && (
          <ul className="space-y-3">
            {items.map((m) => (
              <li key={`${m.kind}-${m.id}`} className={m.kind === 'in' ? 'rounded-lg bg-tone-info-bg px-3 py-2' : 'rounded-lg bg-muted px-3 py-2'}>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">{m.kind === 'in' ? 'Resposta do lead' : 'Você'}</strong>
                  <span>{channels[m.channel as Channel]}</span>
                  <span>{formatDateTime(m.at)}</span>
                  {m.kind === 'out' && <StatusBadge>{outStatus[m.status as keyof typeof outStatus] ?? m.status}</StatusBadge>}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  )
}

function ConvertToClient({ lead, canWrite }: { lead: LeadLite; canWrite: boolean }) {
  const matches = useClientMatches(lead, !lead.converted_client_id)
  const convert = useConvertLead(lead.id)
  const [project, setProject] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (lead.converted_client_id) {
    return (
      <Plate id="convert-h" title="Cliente">
        <p className="text-sm">
          Este lead já virou cliente.{' '}
          <Link to={`/app/clientes/${lead.converted_client_id}`} className="font-semibold text-primary-strong underline">
            Abrir o cliente
          </Link>
        </p>
      </Plate>
    )
  }

  const run = async (existingClientId?: string) => {
    setError(null)
    setMessage(null)
    try {
      await convert.mutateAsync({ existingClientId, projectName: project.trim() || undefined })
      setMessage(existingClientId ? 'Lead vinculado ao cliente.' : 'Cliente criado a partir do lead.')
    } catch {
      setError('Não foi possível converter o lead.')
    }
  }

  return (
    <Plate id="convert-h" title="Converter em cliente">
      <div className="max-w-xl space-y-3">
        <p className="text-sm text-muted-foreground">
          Cria o cliente com os dados do lead (e o contato principal) e marca o lead como ganho. Se o cliente já existir, vincule em vez de duplicar.
        </p>
        {(matches.data?.length ?? 0) > 0 && (
          <div role="group" aria-label="Clientes parecidos" className="space-y-2 rounded-lg bg-tone-warning-bg p-3">
            <p className="text-sm font-semibold text-tone-warning">Já existe cliente parecido:</p>
            <ul className="space-y-2">
              {matches.data!.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {c.name}
                    {c.email ? ` · ${c.email}` : ''}
                  </span>
                  {canWrite && (
                    <Button size="sm" variant="outline" disabled={convert.isPending} onClick={() => run(c.id)}>
                      Vincular a este cliente
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {canWrite && (
          <>
            <Field id="convert-project" label="Projeto (opcional)" hint="Se preencher, cria também um projeto com este nome para o cliente.">
              <input id="convert-project" className={controlClass} value={project} onChange={(e) => setProject(e.target.value)} autoComplete="off" />
            </Field>
            <Button disabled={convert.isPending} onClick={() => run()}>
              {convert.isPending ? 'Convertendo…' : 'Criar novo cliente'}
            </Button>
          </>
        )}
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
      </div>
    </Plate>
  )
}
