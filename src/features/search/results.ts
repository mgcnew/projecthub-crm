import { projectStatuses } from '@/features/projects/schema'
import { taskStatuses } from '@/features/tasks/schema'
import { formatDateTime } from '@/lib/format'

const label = (map: Record<string, string>, key: string) => map[key] ?? key

export type SearchHit = { id: string; key: string; title: string; subtitle: string; href: string }
export type SearchGroup = { id: 'tasks' | 'projects' | 'clients' | 'events'; label: string; hits: SearchHit[] }

type TaskRow = { id: string; title: string; status: string }
type ProjectRow = { id: string; name: string; status: string }
type ClientRow = { id: string; name: string; company_name: string | null }
type EventRow = { id: string; title: string; event_type: string; starts_at: string }

/** Monta os grupos na ordem de exibição; grupos sem resultado não aparecem. */
export function buildGroups(raw: {
  tasks: TaskRow[]
  projects: ProjectRow[]
  clients: ClientRow[]
  events: EventRow[]
}): SearchGroup[] {
  const groups: SearchGroup[] = [
    {
      id: 'tasks',
      label: 'Tarefas',
      hits: raw.tasks.map((t) => ({
        id: t.id,
        key: `task-${t.id}`,
        title: t.title,
        subtitle: label(taskStatuses, t.status),
        href: `/app/tarefas/${t.id}`,
      })),
    },
    {
      id: 'projects',
      label: 'Projetos',
      hits: raw.projects.map((p) => ({
        id: p.id,
        key: `project-${p.id}`,
        title: p.name,
        subtitle: label(projectStatuses, p.status),
        href: `/app/projetos/${p.id}`,
      })),
    },
    {
      id: 'clients',
      label: 'Clientes',
      hits: raw.clients.map((c) => ({
        id: c.id,
        key: `client-${c.id}`,
        title: c.name,
        subtitle: c.company_name ?? 'Cliente',
        href: `/app/clientes/${c.id}`,
      })),
    },
    {
      id: 'events',
      label: 'Reuniões e eventos',
      hits: raw.events.map((e) => ({
        id: e.id,
        key: `event-${e.id}`,
        title: e.title,
        subtitle: `${e.event_type === 'meeting' ? 'Reunião' : 'Evento'} · ${formatDateTime(e.starts_at)}`,
        href: e.event_type === 'meeting' ? `/app/reunioes/${e.id}` : `/app/agenda/${e.id}`,
      })),
    },
  ]
  return groups.filter((g) => g.hits.length > 0)
}

export const flattenHits = (groups: SearchGroup[]) => groups.flatMap((g) => g.hits)
