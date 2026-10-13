import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useAccessEntries } from './api'
import { AccessList } from './AccessList'

/** Acessos de um projeto ou de um cliente (e dos projetos dele), como aba do registro. */
export function LinkedAccess({
  projectId,
  clientId,
  projectIds,
  ready = true,
}: {
  projectId?: string
  clientId?: string
  projectIds?: string[]
  ready?: boolean
}) {
  const { canWrite } = useCurrentWorkspace()
  const q = useAccessEntries({ search: '', archived: 'active', projectId, clientId, projectIds }, ready)
  const params = new URLSearchParams()
  if (projectId) params.set('projeto', projectId)
  if (clientId && !projectId) params.set('cliente', clientId)
  const newHref = `/app/acessos/novo?${params.toString()}`

  return (
    <section aria-labelledby="access-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="access-h" className="section-title">
          Acessos
        </h2>
        {canWrite && (
          <Button asChild variant="outline">
            <Link to={newHref}>Novo acesso</Link>
          </Button>
        )}
      </div>
      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar os acessos." onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.count === 0 && (
        <EmptyState
          title="Nenhum acesso ligado"
          description="Guarde aqui o painel, o repositório e o usuário usados neste trabalho. Senhas ficam no seu gerenciador."
        />
      )}
      {q.isSuccess && q.data.count > 0 && <AccessList rows={q.data.rows} showLinks={Boolean(clientId && !projectId)} />}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <KeyRound aria-hidden="true" className="size-4 shrink-0" />
        Aqui só ficam endereço e usuário. Nunca a senha.
      </p>
    </section>
  )
}
