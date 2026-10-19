import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EntityView } from '@/components/entity/EntityView'
import { ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { useArchiveLead, useLead, useLeadSuppression, useSetOptOut, useUpdateLead } from './api'
import { LeadForm } from './LeadForm'
import { leadErrorMessage, type LeadFormValues } from './schema'
import { TemperatureBadge } from './TemperatureBadge'

export function LeadDetailPage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useLead(id)
  const update = useUpdateLead(id)
  const archive = useArchiveLead(id)
  const lead = q.data
  const optOut = useSetOptOut({ id, email: lead?.email ?? null, phone: lead?.phone ?? null })
  const suppression = useLeadSuppression(lead)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'archive' | 'optout' | 'reactivate' | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o lead." onRetry={() => q.refetch()} />
  if (!lead) return <ErrorState message="Lead não encontrado." />

  const leadAsked = (suppression.data ?? []).some((s) => s.reason !== 'manual')
  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setError(null)
    try {
      await fn()
      setMessage(ok)
    } catch {
      setError(fail)
    } finally {
      setConfirm(null)
    }
  }

  return (
    <EntityView
      kind="Lead"
      title={lead.company_name}
      description={[lead.contact_name, formatPhone(lead.phone), lead.email].filter(Boolean).join(' · ') || undefined}
      actions={
        <>
          <TemperatureBadge value={lead.temperature} />
          {lead.opted_out_at && <StatusBadge>Não contatar desde {formatDate(lead.opted_out_at)}</StatusBadge>}
          {lead.archived_at && <StatusBadge>Arquivado em {formatDate(lead.archived_at)}</StatusBadge>}
          {canWrite && (
            <>
              {lead.opted_out_at ? (
                <Button variant="outline" disabled={leadAsked} onClick={() => setConfirm('reactivate')}>
                  Reativar contato
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setConfirm('optout')}>
                  Não contatar
                </Button>
              )}
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={() =>
                  lead.archived_at
                    ? void run(() => archive.mutateAsync(false), 'Lead restaurado.', 'Não foi possível restaurar.')
                    : setConfirm('archive')
                }
              >
                {lead.archived_at ? 'Restaurar' : 'Arquivar'}
              </Button>
            </>
          )}
        </>
      }
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <>
              {lead.opted_out_at && (
                <p role="status" className="border border-foreground bg-card px-3 py-2 text-sm font-medium">
                  {leadAsked
                    ? 'O próprio lead pediu para não ser contatado. Ele não recebe mensagens em nenhum canal.'
                    : 'Marcado como "não contatar": e-mail e telefone dele estão bloqueados para envio em todos os canais.'}
                </p>
              )}
              {message && (
                <p role="status" className="text-sm text-emerald-700">
                  {message}
                </p>
              )}
              <LeadForm
                key={lead.updated_at}
                initial={{
                  company_name: lead.company_name,
                  contact_name: lead.contact_name ?? '',
                  email: lead.email ?? '',
                  phone: formatPhone(lead.phone),
                  website: lead.website ?? '',
                  address_line: lead.address_line ?? '',
                  city: lead.city ?? '',
                  state: lead.state ?? '',
                  segment: lead.segment ?? '',
                  source: lead.source,
                  temperature: lead.temperature as LeadFormValues['temperature'],
                  stage: lead.stage as LeadFormValues['stage'],
                  lost_reason: lead.lost_reason ?? '',
                  hook: lead.hook ?? '',
                  notes: lead.notes ?? '',
                  next_contact_on: lead.next_contact_on ?? '',
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
                    setError(leadErrorMessage(e))
                  }
                }}
              />
            </>
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={confirm === 'archive'}
        title={`Arquivar “${lead.company_name}”?`}
        description="O lead sai da lista ativa. Você pode restaurá-lo a qualquer momento."
        confirmLabel="Arquivar lead"
        pending={archive.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(() => archive.mutateAsync(true), 'Lead arquivado.', 'Não foi possível arquivar.')}
      />
      <ConfirmDialog
        open={confirm === 'optout'}
        title={`Não contatar “${lead.company_name}”?`}
        description="O e-mail e o telefone deste lead entram na lista de não contatar e ficam bloqueados para envio em todos os canais."
        confirmLabel="Não contatar"
        pending={optOut.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(() => optOut.mutateAsync(true), 'Lead marcado como não contatar.', 'Não foi possível marcar.')}
      />
      <ConfirmDialog
        open={confirm === 'reactivate'}
        title={`Reativar o contato com “${lead.company_name}”?`}
        description="Só reative se o lead não pediu para sair. O e-mail e o telefone voltam a poder receber mensagens."
        confirmLabel="Reativar contato"
        tone="default"
        pending={optOut.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(() => optOut.mutateAsync(false), 'Contato reativado.', 'Não foi possível reativar.')}
      />
    </EntityView>
  )
}
