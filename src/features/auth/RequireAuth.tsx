import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'

export function RequireAuth() {
  const { session, loading, needsSecondFactor } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center text-muted-foreground">
        Carregando…
      </div>
    )
  }
  // Sem sessão, ou com a senha aceita mas sem o código: o banco só entrega dados em aal2 (D082).
  if (!session || needsSecondFactor) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
