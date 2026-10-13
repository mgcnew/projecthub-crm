import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EntityView } from '@/components/entity/EntityView'
import { ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate } from '@/lib/format'
import { useAccessEntry, useArchiveAccess, useDeleteAccess, useUpdateAccess } from './api'
import { AccessForm } from './AccessForm'

export function AccessDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { canWrite } = useCurrentWorkspace()
  const q = useAccessEntry(id)
  const update = useUpdateAccess(id)
  const archive = useArchiveAccess(id)
  const remove = useDeleteAccess(id)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o acesso." onRetry={() => q.refetch()} />
  const a = q.data
  if (!a) return <ErrorState message="Acesso não encontrado." />

  return (
    <EntityView
      kind="Acesso"
      title={a.name}
      description={a.category ?? undefined}
      actions={
        <>
          {a.archived_at && <StatusBadge>Arquivado em {formatDate(a.archived_at)}</StatusBadge>}
          {canWrite && (
            <>
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={async () => {
                  if (!a.archived_at) return setConfirm('archive')
                  setError(null)
                  try {
                    await archive.mutateAsync(false)
                    setMessage('Acesso restaurado.')
                  } catch {
                    setError('Não foi possível alterar o arquivamento.')
                  }
                }}
              >
                {a.archived_at ? 'Restaurar' : 'Arquivar'}
              </Button>
              <Button variant="outline" onClick={() => setConfirm('delete')}>
                Excluir
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
              {message && (
                <p role="status" className="text-sm text-emerald-700">
                  {message}
                </p>
              )}
              <AccessForm
                key={a.updated_at}
                initial={{
                  name: a.name,
                  category: a.category ?? '',
                  url: a.url ?? '',
                  username: a.username ?? '',
                  manager_item: a.manager_item ?? '',
                  project_id: a.project_id ?? '',
                  client_id: a.client_id ?? '',
                  notes: a.notes ?? '',
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
            </>
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={confirm === 'archive'}
        title={`Arquivar “${a.name}”?`}
        description="O acesso sai da lista ativa. Você pode restaurá-lo a qualquer momento."
        confirmLabel="Arquivar acesso"
        pending={archive.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setError(null)
          try {
            await archive.mutateAsync(true)
            setMessage('Acesso arquivado.')
          } catch {
            setError('Não foi possível alterar o arquivamento.')
          } finally {
            setConfirm(null)
          }
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Excluir “${a.name}”?`}
        description="O registro é removido de vez e não há como desfazer. Isso não apaga nada no próprio serviço nem no seu gerenciador de senhas."
        confirmLabel="Excluir acesso"
        pending={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setError(null)
          try {
            await remove.mutateAsync()
            navigate('/app/acessos', { replace: true })
          } catch {
            setError('Não foi possível excluir o acesso.')
            setConfirm(null)
          }
        }}
      />
    </EntityView>
  )
}
