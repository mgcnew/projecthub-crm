import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { useArchiveProject, useProject, useUpdateProject } from './api'
import { ProjectForm } from './ProjectForm'
import { ProjectLogs } from './ProjectLogs'

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useProject(id)
  const update = useUpdateProject(id)
  const archive = useArchiveProject(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o projeto." onRetry={() => q.refetch()} />
  const p = q.data
  if (!p) return <ErrorState message="Projeto não encontrado." />

  return (
    <>
      <PageHeader
        title={p.name}
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
                  setError(null)
                  try {
                    await archive.mutateAsync(!p.archived_at)
                    setMessage(p.archived_at ? 'Projeto restaurado.' : 'Projeto arquivado.')
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

      <ProjectLogs projectId={p.id} />
    </>
  )
}
