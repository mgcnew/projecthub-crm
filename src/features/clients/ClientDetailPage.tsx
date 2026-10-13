import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ActivityTimeline } from '@/features/activity/ActivityTimeline'
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useProjectsByClient } from '@/features/projects/api'
import { projectStatuses } from '@/features/projects/schema'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { useArchiveClient, useClient, useUpdateClient } from './api'
import { ClientForm } from './ClientForm'

export function ClientDetailPage() {
  const { id = '' } = useParams()
  const { canWrite } = useCurrentWorkspace()
  const q = useClient(id)
  const update = useUpdateClient(id)
  const archive = useArchiveClient(id)
  const projects = useProjectsByClient(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o cliente." onRetry={() => q.refetch()} />
  const c = q.data
  if (!c) return <ErrorState message="Cliente não encontrado." />

  return (
    <>
      <PageHeader
        title={c.name}
        description={c.company_name ?? undefined}
        actions={
          <>
            {c.archived_at && <StatusBadge>Arquivado em {formatDate(c.archived_at)}</StatusBadge>}
            {canWrite && (
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={async () => {
                  setError(null)
                  try {
                    await archive.mutateAsync(!c.archived_at)
                    setMessage(c.archived_at ? 'Cliente restaurado.' : 'Cliente arquivado.')
                  } catch {
                    setError('Não foi possível alterar o arquivamento.')
                  }
                }}
              >
                {c.archived_at ? 'Restaurar' : 'Arquivar'}
              </Button>
            )}
          </>
        }
      />
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}

      <ClientForm
        key={c.updated_at}
        initial={{
          name: c.name,
          company_name: c.company_name ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          status: c.status as 'active' | 'inactive',
          notes: c.notes ?? '',
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

      <section aria-labelledby="client-projects" className="space-y-3">
        <h2 id="client-projects" className="text-lg font-semibold">
          Projetos
        </h2>
        {projects.isPending && <LoadingState />}
        {projects.isError && <ErrorState message="Não foi possível carregar os projetos." onRetry={() => projects.refetch()} />}
        {projects.isSuccess && projects.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum projeto vinculado.</p>
        )}
        {projects.isSuccess && projects.data.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {projects.data.map((p) => (
              <li key={p.id}>
                <Link to={`/app/projetos/${p.id}`} className="flex min-h-12 items-center justify-between gap-2 px-4 py-3 hover:bg-muted">
                  <span className="font-medium">{p.name}</span>
                  <StatusBadge>{projectStatuses[p.status as keyof typeof projectStatuses] ?? p.status}</StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ActivityTimeline entityType="client" entityId={c.id} />
    </>
  )
}
