import { Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RouteError } from '@/components/RouteError'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RecoverPasswordPage } from '@/features/auth/RecoverPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { appRoutes } from './appRoutes'

// Rotas de módulos entram junto com cada fase; nada de menu para módulo inexistente.
export const routes: RouteObject[] = [
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Navigate to="/app" replace /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/recuperar-senha', element: <RecoverPasswordPage /> },
      { path: '/redefinir-senha', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell pages={appRoutes} />,
            children: appRoutes,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
