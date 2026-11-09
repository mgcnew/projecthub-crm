import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useOutboxMessage, useUpdateOutbox } from './api'
import { lintMessage } from './lint'
import { channels, type Channel } from './schema'

const statusLabel = { draft: 'Rascunho', approved: 'Aprovada', cancelled: 'Cancelada', sending: 'Enviando', sent: 'Enviada', failed: 'Falhou' } as const

function serverMessage(e: unknown) {
  const m = (e as { message?: string } | null)?.message
  return m && /lista de supressão|não ser contatado|arquivado|WhatsApp só|sem (e-mail|telefone)/.test(m) ? m : 'Não foi possível atualizar a mensagem. Tente de novo.'
}

/** Revisão de uma mensagem da fila: editar (só rascunho), aprovar, devolver para rascunho ou cancelar. */
export function OutboxMessagePage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useOutboxMessage(id)
  const update = useUpdateOutbox(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar a mensagem." onRetry={() => q.refetch()} />
  const m = q.data
  if (!m) return <ErrorState message="Mensagem não encontrada." />

  return (
    <EntityView
      kind="Mensagem"
      title={m.leads?.company_name ?? 'Mensagem'}
      description={`${channels[m.channel as Channel]} · ${m.to_address}`}
      actions={
        <>
          {m.generated_by === 'ai' && <StatusBadge tone="violet">Escrito pela IA</StatusBadge>}
          <StatusBadge tone={m.status === 'approved' ? 'success' : m.status === 'draft' ? 'warning' : 'neutral'}>{statusLabel[m.status as keyof typeof statusLabel] ?? m.status}</StatusBadge>
        </>
      }
      tabs={[
        {
          id: 'mensagem',
          label: 'Mensagem',
          content: (
            <MessageEditor
              key={m.updated_at}
              channel={m.channel as Channel}
              step={m.message_templates?.step ?? 1}
              status={m.status}
              initialSubject={m.subject ?? ''}
              initialBody={m.body}
              approvedAt={m.approved_at}
              sentAt={m.sent_at}
              lastError={m.last_error}
              leadId={m.leads?.id ?? m.lead_id}
              canWrite={canWrite}
              pending={update.isPending}
              message={message}
              error={error}
              onAct={async (patch, doneMessage) => {
                setError(null)
                setMessage(null)
                try {
                  await update.mutateAsync(patch)
                  setMessage(doneMessage)
                } catch (e) {
                  setError(serverMessage(e))
                }
              }}
            />
          ),
        },
      ]}
    />
  )
}

function MessageEditor({
  channel,
  step,
  status,
  initialSubject,
  initialBody,
  approvedAt,
  sentAt,
  lastError,
  leadId,
  canWrite,
  pending,
  message,
  error,
  onAct,
}: {
  channel: Channel
  step: number
  status: string
  initialSubject: string
  initialBody: string
  approvedAt: string | null
  sentAt: string | null
  lastError: string | null
  leadId: string
  canWrite: boolean
  pending: boolean
  message: string | null
  error: string | null
  onAct: (patch: { subject?: string | null; body?: string; status?: 'draft' | 'approved' | 'cancelled' }, doneMessage: string) => Promise<void>
}) {
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const editable = canWrite && status === 'draft'
  const dirty = subject !== initialSubject || body !== initialBody
  const warnings = lintMessage({ channel, step, text: body, subject: channel === 'email' ? subject : null })
  const content = { body, ...(channel === 'email' ? { subject } : {}) }

  return (
    <div className="space-y-4">
      {channel === 'email' && (
        <Field id="msg-subject" label="Assunto">
          <input id="msg-subject" className={controlClass} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} />
        </Field>
      )}
      <Field id="msg-body" label="Mensagem" hint={editable ? 'Edite à vontade: este é o texto final que será enviado quando você aprovar.' : undefined}>
        <textarea id="msg-body" className={textareaClass + ' min-h-48'} value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} />
      </Field>

      {warnings.length > 0 ? (
        <ul aria-label="Avisos de estilo" className="space-y-1.5">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="rounded-md bg-tone-warning-bg px-3 py-1.5 text-sm text-tone-warning">
              {w.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-tone-success">Sem avisos de estilo.</p>
      )}
      {/\{\{[^}]+\}\}/.test(body) && (
        <p role="alert" className="rounded-md bg-tone-danger-bg px-3 py-1.5 text-sm text-tone-danger">
          O texto ainda tem um {'{{marcador}}'} sem preencher. Corrija antes de aprovar.
        </p>
      )}

      {sentAt && <p className="text-sm text-tone-success">Enviada em {formatDateTime(sentAt)}.</p>}
      {status === 'failed' && lastError && (
        <p role="alert" className="rounded-md bg-tone-danger-bg px-3 py-1.5 text-sm text-tone-danger">
          Não foi possível enviar: {lastError}
        </p>
      )}
      {approvedAt && status === 'approved' && <p className="text-sm text-muted-foreground">Aprovada em {formatDateTime(approvedAt)}. Para editar, volte para rascunho.</p>}
      <p className="text-sm">
        <Link to={`/app/prospeccao/leads/${leadId}`} className="font-semibold text-primary-strong underline">
          Abrir o lead
        </Link>
      </p>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {status === 'draft' && (
            <>
              <Button disabled={pending || !dirty} onClick={() => onAct(content, 'Alterações salvas.')}>
                Salvar edição
              </Button>
              <Button disabled={pending || /\{\{[^}]+\}\}/.test(body)} onClick={() => onAct({ ...content, status: 'approved' }, 'Mensagem aprovada. Nada foi enviado.')}>
                Aprovar
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => onAct({ status: 'cancelled' }, 'Mensagem cancelada.')}>
                Cancelar mensagem
              </Button>
            </>
          )}
          {status === 'failed' && (
            <Button variant="outline" disabled={pending} onClick={() => onAct({ status: 'draft' }, 'Voltou para rascunho. Corrija e aprove de novo.')}>
              Voltar para rascunho
            </Button>
          )}
          {status === 'approved' && (
            <>
              <Button variant="outline" disabled={pending} onClick={() => onAct({ status: 'draft' }, 'Voltou para rascunho.')}>
                Voltar para rascunho
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => onAct({ status: 'cancelled' }, 'Mensagem cancelada.')}>
                Cancelar mensagem
              </Button>
            </>
          )}
        </div>
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
  )
}
