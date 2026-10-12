import { Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AppHomePage } from '@/pages/AppHomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Rotas de módulos (/app/...) entram junto com cada fase; nada de menu para módulo inexistente.
export const routes: RouteObject[] = [
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      { path: '/', element: <Navigate to="/app" replace /> },
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/app', element: <AppHomePage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
