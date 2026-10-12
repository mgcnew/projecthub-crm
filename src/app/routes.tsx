import { Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ClientDetailPage } from '@/features/clients/ClientDetailPage'
import { ClientNewPage } from '@/features/clients/ClientNewPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage'
import { ProjectNewPage } from '@/features/projects/ProjectNewPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { AppHomePage } from '@/pages/AppHomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Rotas de módulos entram junto com cada fase; nada de menu para módulo inexistente.
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
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/app', element: <AppHomePage /> },
              { path: '/app/clientes', element: <ClientsPage /> },
              { path: '/app/clientes/novo', element: <ClientNewPage /> },
              { path: '/app/clientes/:id', element: <ClientDetailPage /> },
              { path: '/app/projetos', element: <ProjectsPage /> },
              { path: '/app/projetos/novo', element: <ProjectNewPage /> },
              { path: '/app/projetos/:id', element: <ProjectDetailPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
