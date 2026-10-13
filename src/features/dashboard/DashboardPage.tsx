import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useOccurrences } from '@/features/calendar/api'
import { useUnreadCount } from '@/features/notifications/api'
import { notificationHref } from '@/features/notifications/schema'
import { useDayPlans, useSetTaskStatus } from '@/features/tasks/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, formatDate, formatDateTime, todayISO } from '@/lib/format'
import { useActiveProjectCount, useOverdueTasks, useRecentUnread, useUpcomingTasks } from './api'

type DashTask = {
  id: string
  title: string
  status: string
  priority?: string
  due_date: string | null
  due_at: string | null
  projects: { name: string } | null
}

const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const typeLabel: Record<string, string> = { event: 'Evento', meeting: 'Reunião', work_block: 'Bloco de foco' }

function Tile({ label, value, tone }: { label: string; value: ReactNode; tone?: 'danger' }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className={tone === 'danger' ? 'text-2xl font-semibold text-destructive' : 'text-2xl font-semibold'}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function TaskRow({ task, canWrite, onToggle }: { task: DashTask; canWrite: boolean; onToggle: (done: boolean) => void }) {
  const done = task.status === 'done'
  const due = task.due_at ? formatDateTime(task.due_at) : task.due_date ? formatDate(task.due_date) : null
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <input
        type="checkbox"
        className="size-5"
        aria-label={`Concluir ${task.title}`}
        checked={done}
        disabled={!canWrite}
        onChange={() => onToggle(!done)}
      />
      <Link to={`/app/tarefas/${task.id}`} className="min-h-11 flex-1 content-center">
        <span className={done ? 'text-muted-foreground line-through' : 'font-medium'}>{task.title}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {task.projects?.name ?? ''}
          {due && `${task.projects?.name ? ' · ' : ''}prazo ${due}`}
        </span>
      </Link>
    </li>
  )
}

export function DashboardPage() {
  const { workspace, orgId, canWrite, isPending, isError, refetch } = useCurrentWorkspace()
  const enabled = Boolean(orgId)
  const today = todayISO()
  const weekEnd = addDays(today, 7)

  const { from, to } = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number)
    return { from: new Date(y, m - 1, d).toISOString(), to: new Date(y, m - 1, d + 1).toISOString() }
  }, [today])

  const overdue = useOverdueTasks(today, enabled)
  const upcoming = useUpcomingTasks(today, weekEnd, enabled)
  const plans = useDayPlans(today, enabled)
  const agenda = useOccurrences(from, to, enabled)
  const unreadCount = useUnreadCount(enabled)
  const unread = useRecentUnread(enabled)
  const projects = useActiveProjectCount(enabled)
  const setStatus = useSetTaskStatus()

  if (isPending) return <LoadingState label="Carregando espaço de trabalho…" />
  if (isError) return <ErrorState message="Não foi possível carregar seu espaço de trabalho." onRetry={() => refetch()} />
  if (!workspace)
    return (
      <p role="alert" className="text-destructive">
        Nenhum espaço de trabalho ativo para esta conta. Contate o administrador.
      </p>
    )

  const planRows = (plans.data ?? []).filter((p) => p.tasks)
  const plannedDone = planRows.filter((p) => (p.tasks as unknown as DashTask).status === 'done').length
  const agendaRows = (agenda.data ?? []).filter((o) => o.event_type !== 'work_block' || o.task_id)
  const toggle = (id: string) => (done: boolean) => setStatus.mutate({ id, status: done ? 'done' : 'todo' })
  const failed = [overdue, upcoming, plans, agenda].some((q) => q.isError)

  return (
    <>
      <PageHeader
        title="Central do dia"
        description={`${new Date(`${today}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · ${workspace.name}`}
      />

      {failed && (
        <ErrorState
          message="Parte das informações não pôde ser carregada."
          onRetry={() => {
            void overdue.refetch()
            void upcoming.refetch()
            void plans.refetch()
            void agenda.refetch()
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Tarefas atrasadas" value={overdue.data?.count ?? '—'} tone={(overdue.data?.count ?? 0) > 0 ? 'danger' : undefined} />
        <Tile label="Planejadas para hoje" value={plans.isSuccess ? `${plannedDone}/${planRows.length}` : '—'} />
        <Tile label="Compromissos hoje" value={agenda.isSuccess ? agendaRows.length : '—'} />
        <Tile label="Projetos ativos" value={projects.data ?? '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          id="dash-today"
          title="Hoje"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/meu-dia">Abrir Meu dia</Link>
            </Button>
          }
        >
          {plans.isPending && <LoadingState />}
          {plans.isSuccess && planRows.length === 0 && (
            <EmptyState title="Nada planejado para hoje" description="Planeje tarefas no Meu dia." />
          )}
          {planRows.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {planRows.map((p) => {
                const t = p.tasks as unknown as DashTask
                return <TaskRow key={p.id} task={t} canWrite={canWrite} onToggle={toggle(t.id)} />
              })}
            </ul>
          )}
        </Section>

        <Section
          id="dash-agenda"
          title="Agenda de hoje"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/agenda">Abrir agenda</Link>
            </Button>
          }
        >
          {agenda.isPending && <LoadingState />}
          {agenda.isSuccess && agendaRows.length === 0 && <EmptyState title="Nenhum compromisso hoje" />}
          {agendaRows.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {agendaRows.map((o) => {
                const href =
                  o.event_type === 'meeting'
                    ? `/app/reunioes/${o.event_id}`
                    : o.event_type === 'work_block' && o.task_id
                      ? `/app/tarefas/${o.task_id}`
                      : `/app/agenda/${o.event_id}`
                return (
                  <li key={`${o.event_id}-${o.occurrence_start}`}>
                    <Link to={href} className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-muted">
                      <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {timeFmt(o.occurrence_start)}–{timeFmt(o.occurrence_end)}
                      </span>
                      <span className="flex-1 font-medium">{o.title}</span>
                      <StatusBadge>{typeLabel[o.event_type] ?? o.event_type}</StatusBadge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section id="dash-overdue" title="Atrasadas">
          {overdue.isPending && <LoadingState />}
          {overdue.isSuccess && overdue.data.rows.length === 0 && <EmptyState title="Nenhuma tarefa atrasada" />}
          {(overdue.data?.rows.length ?? 0) > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {overdue.data!.rows.map((t) => (
                <TaskRow key={t.id} task={t as unknown as DashTask} canWrite={canWrite} onToggle={toggle(t.id)} />
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="dash-upcoming"
          title="Próximos prazos (7 dias)"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/tarefas">Todas as tarefas</Link>
            </Button>
          }
        >
          {upcoming.isPending && <LoadingState />}
          {upcoming.isSuccess && upcoming.data.length === 0 && <EmptyState title="Nenhum prazo nos próximos dias" />}
          {(upcoming.data?.length ?? 0) > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {upcoming.data!.map((t) => (
                <TaskRow key={t.id} task={t as unknown as DashTask} canWrite={canWrite} onToggle={toggle(t.id)} />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        id="dash-notifications"
        title={`Notificações${unreadCount.data ? ` (${unreadCount.data} não lida${unreadCount.data > 1 ? 's' : ''})` : ''}`}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/notificacoes">Ver todas</Link>
          </Button>
        }
      >
        {unread.isSuccess && unread.data.length === 0 && <EmptyState title="Nenhuma notificação não lida" />}
        {(unread.data?.length ?? 0) > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {unread.data!.map((n) => {
              const href = notificationHref(n) ?? '/app/notificacoes'
              return (
                <li key={n.id}>
                  <Link to={href} className="flex min-h-11 flex-wrap items-center gap-x-3 px-4 py-2 hover:bg-muted">
                    <span className="font-medium">{n.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {n.body ? `${n.body} · ` : ''}
                      {formatDateTime(n.created_at)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </>
  )
}
