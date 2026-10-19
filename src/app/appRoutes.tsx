import type { RouteObject } from 'react-router-dom'
import { ImportPage } from '@/features/leads/import/ImportPage'
import { LeadDetailPage } from '@/features/leads/LeadDetailPage'
import { LeadNewPage } from '@/features/leads/LeadNewPage'
import { LeadsPage } from '@/features/leads/LeadsPage'
import { AccessDetailPage } from '@/features/access/AccessDetailPage'
import { AccessesPage } from '@/features/access/AccessesPage'
import { AccessNewPage } from '@/features/access/AccessNewPage'
import { AgendaPage } from '@/features/calendar/AgendaPage'
import { EventDetailPage } from '@/features/calendar/EventDetailPage'
import { EventNewPage } from '@/features/calendar/EventNewPage'
import { MeetingDetailPage } from '@/features/calendar/MeetingDetailPage'
import { MeetingsPage } from '@/features/calendar/MeetingsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
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

/** Rotas de página do aplicativo (dentro do AppShell). O AppShell as renderiza por conta própria,
 * para poder mostrar a página de origem ao fundo quando um registro abre em painel (desktop). */
export const appRoutes: RouteObject[] = [
  { path: '/app', element: <DashboardPage /> },
  { path: '/app/meu-dia', element: <MyDayPage /> },
  { path: '/app/notificacoes', element: <NotificationsPage /> },
  { path: '/app/configuracoes', element: <SettingsPage /> },
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
  { path: '/app/prospeccao', element: <LeadsPage /> },
  { path: '/app/prospeccao/importar', element: <ImportPage /> },
  { path: '/app/prospeccao/leads/novo', element: <LeadNewPage /> },
  { path: '/app/prospeccao/leads/:id', element: <LeadDetailPage /> },
  { path: '/app/acessos', element: <AccessesPage /> },
  { path: '/app/acessos/novo', element: <AccessNewPage /> },
  { path: '/app/acessos/:id', element: <AccessDetailPage /> },
  { path: '/app/projetos', element: <ProjectsPage /> },
  { path: '/app/projetos/novo', element: <ProjectNewPage /> },
  { path: '/app/projetos/:id', element: <ProjectDetailPage /> },
]
