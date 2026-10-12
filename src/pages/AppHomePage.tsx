import { ErrorState, LoadingState, PageHeader } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'

export function AppHomePage() {
  const { workspace, isPending, isError, refetch } = useCurrentWorkspace()

  return (
    <>
      <PageHeader title="Início" />
      {isPending && <LoadingState label="Carregando espaço de trabalho…" />}
      {isError && <ErrorState message="Não foi possível carregar seu espaço de trabalho." onRetry={() => refetch()} />}
      {!isPending && !isError && !workspace && (
        <p role="alert" className="text-destructive">
          Nenhum espaço de trabalho ativo para esta conta. Contate o administrador.
        </p>
      )}
      {workspace && (
        <p className="text-muted-foreground">
          {workspace.name} · <span className="capitalize">{workspace.role}</span>
        </p>
      )}
    </>
  )
}
