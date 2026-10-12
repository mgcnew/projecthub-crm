import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useWorkspaces } from '@/features/workspace/useWorkspace'

export function AppHomePage() {
  const { session, signOut } = useAuth()
  const queryClient = useQueryClient()
  const workspaces = useWorkspaces(session?.user.id)
  const workspace = workspaces.data?.[0]

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">ProjectHub CRM</h1>

      {workspaces.isPending && <p role="status" className="text-muted-foreground">Carregando espaço de trabalho…</p>}

      {workspaces.isError && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive">Não foi possível carregar seu espaço de trabalho.</p>
          <Button variant="outline" onClick={() => workspaces.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {workspaces.isSuccess && !workspace && (
        <p role="alert" className="text-destructive">
          Nenhum espaço de trabalho ativo para esta conta. Contate o administrador.
        </p>
      )}

      {workspace && (
        <p className="text-muted-foreground">
          {workspace.name} · <span className="capitalize">{workspace.role}</span>
        </p>
      )}

      <Button
        variant="outline"
        className="self-start"
        onClick={async () => {
          await signOut()
          queryClient.clear()
        }}
      >
        Sair
      </Button>
    </main>
  )
}
