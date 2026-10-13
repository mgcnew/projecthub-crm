import { Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AgendaPage } from '@/features/calendar/AgendaPage'
import { EventDetailPage } from '@/features/calendar/EventDetailPage'
import { EventNewPage } from '@/features/calendar/EventNewPage'
import { MeetingDetailPage } from '@/features/calendar/MeetingDetailPage'
import { MeetingsPage } from '@/features/calendar/MeetingsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ClientDetailPage } from '@/features/clients/ClientDetailPage'
import { ClientNewPage } from '@/features/clients/ClientNewPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage'
import { ProjectNewPage } from '@/features/projects/ProjectNewPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { MyDayPage } from '@/features/tasks/MyDayPage'
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { TemplatesPage } from '@/features/tasks/TemplatesPage'
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
              { path: '/app', element: <DashboardPage /> },
              { path: '/app/meu-dia', element: <MyDayPage /> },
              { path: '/app/notificacoes', element: <NotificationsPage /> },
              { path: '/app/agenda', element: <AgendaPage /> },
              { path: '/app/agenda/novo', element: <EventNewPage /> },
              { path: '/app/agenda/:id', element: <EventDetailPage /> },
              { path: '/app/reunioes', element: <MeetingsPage /> },
              { path: '/app/reunioes/:eventId', element: <MeetingDetailPage /> },
              { path: '/app/tarefas', element: <TasksPage /> },
              { path: '/app/tarefas/modelos', element: <TemplatesPage /> },
              { path: '/app/tarefas/:id', element: <TaskDetailPage /> },
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
