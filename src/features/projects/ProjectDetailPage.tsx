import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LineBadge } from '@/components/LineBadge'
import { lineFor } from '@/lib/lines'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { useArchiveProject, useProject, useUpdateProject } from './api'
import { ProjectForm } from './ProjectForm'
import { ActivityTimeline } from '@/features/activity/ActivityTimeline'
import { ProjectLogs } from './ProjectLogs'
import { LinkedEvents } from '@/features/calendar/LinkedEvents'
import { LinkedTasks } from '@/features/tasks/LinkedTasks'

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useProject(id)
  const update = useUpdateProject(id)
  const archive = useArchiveProject(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o projeto." onRetry={() => q.refetch()} />
  const p = q.data
  if (!p) return <ErrorState message="Projeto não encontrado." />

  return (
    <>
      <PageHeader
        title={p.name}
        description={
          <span className="inline-flex items-center gap-2">
            <LineBadge projectId={p.id} projectName={p.name} size="sm" />
            Linha {lineFor(p.id).name}
          </span>
        }
        actions={
          <>
            {p.archived_at && <StatusBadge>Arquivado em {formatDate(p.archived_at)}</StatusBadge>}
            {p.client_id && (
              <Button asChild variant="outline">
                <Link to={`/app/clientes/${p.client_id}`}>Ver cliente</Link>
              </Button>
            )}
            {canWrite && (
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={async () => {
                  if (!p.archived_at) return setConfirmArchive(true)
                  setError(null)
                  try {
                    await archive.mutateAsync(false)
                    setMessage('Projeto restaurado.')
                  } catch {
                    setError('Não foi possível alterar o arquivamento.')
                  }
                }}
              >
                {p.archived_at ? 'Restaurar' : 'Arquivar'}
              </Button>
            )}
          </>
        }
      />
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <ConfirmDialog
        open={confirmArchive}
        title={`Arquivar “${p.name}”?`}
        description="O projeto sai das listas ativas, mas tarefas, reuniões e histórico continuam preservados. Você pode restaurá-lo a qualquer momento."
        confirmLabel="Arquivar projeto"
        pending={archive.isPending}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={async () => {
          setError(null)
          try {
            await archive.mutateAsync(true)
            setMessage('Projeto arquivado.')
          } catch {
            setError('Não foi possível alterar o arquivamento.')
          } finally {
            setConfirmArchive(false)
          }
        }}
      />

      <ProjectForm
        key={p.updated_at}
        initial={{
          name: p.name,
          description: p.description ?? '',
          client_id: p.client_id ?? '',
          status: p.status as 'planning',
          priority: p.priority as 'medium',
          started_on: p.started_on ?? '',
          target_date: p.target_date ?? '',
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
          } catch {
            setError('Não foi possível salvar as alterações.')
          }
        }}
      />

      <LinkedTasks scope={{ projectId: p.id }} />
      <LinkedEvents
        scope={{ projectId: p.id }}
        link={{ projectId: p.id, clientId: p.client_id ?? undefined }}
      />
      <ProjectLogs projectId={p.id} />
      <ActivityTimeline entityType="project" entityId={p.id} />
    </>
  )
}
