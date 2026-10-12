import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Button asChild className="self-start">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </main>
  )
}
