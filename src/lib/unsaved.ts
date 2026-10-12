import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/** Avisa ao sair da tela com alterações não salvas (navegação interna e fechar aba). */
export function useUnsavedChangesGuard(dirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Há alterações não salvas. Deseja sair mesmo assim?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
