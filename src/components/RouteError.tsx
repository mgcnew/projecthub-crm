import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** Fallback de erro de renderização/carregamento de rota (errorElement). */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{notFound ? 'Página não encontrada' : 'Algo deu errado'}</h1>
      <p role="alert" className="text-muted-foreground">
        {notFound
          ? 'O endereço não existe ou foi movido.'
          : 'Ocorreu um erro inesperado nesta tela. Seus dados não foram alterados. Tente recarregar a página.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
        <Button asChild variant="outline">
          <Link to="/app">Ir para o início</Link>
        </Button>
      </div>
    </main>
  )
}
