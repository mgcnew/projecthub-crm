import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DayLine, type DayStop } from '@/components/DayLine'
import { LineStrip } from '@/components/LineBadge'
import { Plate } from '@/components/Plate'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useOccurrences, useWorkBlockProjects } from '@/features/calendar/api'
import { FollowUpsPlate } from '@/features/clients/relationship/FollowUpsPlate'
import { ReceivablesPlate } from '@/features/finance/ReceivablesPlate'
import { occurrenceToStop } from '@/features/calendar/stops'
import { useUnreadCount } from '@/features/notifications/api'
import { notificationHref } from '@/features/notifications/schema'
import { useDayPlans, useSetTaskStatus } from '@/features/tasks/api'
import { dueLabel } from '@/features/tasks/due'
import { TaskTable, type TaskRowData } from '@/features/tasks/TaskTable'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, dayStartInstant, formatDateTime, formatMinutes, todayISO } from '@/lib/format'
import { ActivityFeed } from './ActivityFeed'
import { StatCards } from './StatCards'
import { useActiveProjectCount, useOverdueTasks, useRecentUnread, useUpcomingTasks } from './api'

type PlanTask = TaskRowData & { projects: { name: string } | null }

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function DashboardPage() {
  const { workspace, orgId, canWrite, isPending, isError, refetch } = useCurrentWorkspace()
  const enabled = Boolean(orgId)
  const today = todayISO()
  const weekEnd = addDays(today, 7)
  const { from, to } = useMemo(() => ({ from: dayStartInstant(today), to: dayStartInstant(addDays(today, 1)) }), [today])

  const overdue = useOverdueTasks(today, enabled)
  const upcoming = useUpcomingTasks(today, weekEnd, enabled)
  const plans = useDayPlans(today, enabled)
  const agenda = useOccurrences(from, to, enabled)
  const unreadCount = useUnreadCount(enabled)
  const unread = useRecentUnread(enabled)
  const projects = useActiveProjectCount(enabled)
  const setStatus = useSetTaskStatus()
  const blockProjects = useWorkBlockProjects(agenda.data)

  if (isPending) return <LoadingState label="Carregando espaço de trabalho…" />
  if (isError) return <ErrorState message="Não foi possível carregar seu espaço de trabalho." onRetry={() => refetch()} />
  if (!workspace)
    return (
      <p role="alert" className="text-destructive">
        Nenhum espaço de trabalho ativo para esta conta. Contate o administrador.
      </p>
    )

  const planned: TaskRowData[] = (plans.data ?? [])
    .map((p) => p.tasks as unknown as PlanTask | null)
    .filter((t): t is PlanTask => Boolean(t))
    .map((t) => ({ ...t, projectName: t.projects?.name ?? null }))
  const doneCount = planned.filter((t) => t.status === 'done').length
  const estimate = planned.filter((t) => t.status !== 'done').reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)

  const stops: DayStop[] = (agenda.data ?? []).map((o) => occurrenceToStop(o, blockProjects.data))

  type Due = { id: string; title: string; status: string; due_date: string | null; due_at: string | null; project_id: string | null; projects: { name: string } | null }
  const dueRows = [...((overdue.data?.rows ?? []) as unknown as Due[]), ...((upcoming.data ?? []) as unknown as Due[])]
  const toggle = (t: TaskRowData, done: boolean) => setStatus.mutate({ id: t.id, status: done ? 'done' : 'todo' })
  const failed = [overdue, upcoming, plans, agenda].some((q) => q.isError)
  const rawDate = new Date(`${today}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateText = rawDate.charAt(0).toLocaleUpperCase('pt-BR') + rawDate.slice(1)

  return (
    <>
      <PageHeader
        title="Central do dia"
        description={
          <>
            {dateText} · {workspace.name}
            {projects.data !== undefined && <> · {plural(projects.data, 'projeto ativo', 'projetos ativos')}</>}
          </>
        }
        actions={
          <>
            {canWrite && (
              <Button asChild variant="outline">
                <Link to="/app/agenda/novo">Novo evento</Link>
              </Button>
            )}
            <Button asChild>
              <Link to="/app/meu-dia">Planejar o dia</Link>
            </Button>
          </>
        }
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

      <StatCards
        today={today}
        weekEnd={weekEnd}
        enabled={enabled}
        planned={plans.isSuccess ? { total: planned.length, done: doneCount, remainingMinutes: estimate } : undefined}
        overdueCount={overdue.data?.count}
      />

      <Plate
        id="dash-line"
        title="Linha do dia"
        meta={agenda.isSuccess ? plural(stops.length, 'compromisso', 'compromissos') : undefined}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/agenda">Abrir agenda</Link>
          </Button>
        }
      >
        {agenda.isPending ? <LoadingState rows={1} /> : <DayLine stops={stops} nowISO={new Date().toISOString()} emptyText="Nenhum compromisso hoje." />}
      </Plate>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Plate
          id="dash-today"
          title="Planejado hoje"
          meta={
            plans.isSuccess && planned.length > 0 ? (
              <>
                <span>{doneCount}/{planned.length}</span> concluídas{estimate > 0 && ` · ${formatMinutes(estimate)} restantes`}
              </>
            ) : undefined
          }
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/meu-dia">Abrir Meu dia</Link>
            </Button>
          }
        >
          {plans.isPending && <LoadingState />}
          {plans.isSuccess && planned.length === 0 && (
            <EmptyState
              inset
              title="Nada planejado para hoje"
              description="Escolha no Meu dia o que você vai fazer hoje; o prazo de cada tarefa não muda."
              action={
                <Button asChild variant="outline">
                  <Link to="/app/meu-dia">Planejar o dia</Link>
                </Button>
              }
            />
          )}
          {planned.length > 0 && (
            <TaskTable rows={planned} caption="Tarefas planejadas para hoje" canWrite={canWrite} onToggle={toggle} pending={setStatus.isPending} />
          )}
        </Plate>

        <Plate
          id="dash-due"
          title="Prazos"
          meta={overdue.data && overdue.data.count > 0 ? <span className="text-destructive">{plural(overdue.data.count, 'atrasada', 'atrasadas')}</span> : 'próximos 7 dias'}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/tarefas">Todas</Link>
            </Button>
          }
        >
          {(overdue.isPending || upcoming.isPending) && <LoadingState />}
          {overdue.isSuccess && upcoming.isSuccess && dueRows.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">Nenhum prazo atrasado nem nos próximos 7 dias.</p>
          )}
          {dueRows.length > 0 && (
            <ul>
              {dueRows.map((t) => {
                const due = dueLabel(t)
                return (
                  <li key={t.id} className="border-b border-border last:border-b-0">
                    <Link to={`/app/tarefas/${t.id}`} className="flex min-h-14 items-stretch gap-3 py-2 hover:bg-muted/60">
                      <LineStrip projectId={t.project_id} />
                      <span className="flex min-w-0 flex-1 flex-col justify-center">
                        <span className="truncate font-semibold">{t.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{t.projects?.name ?? 'Sem projeto'}</span>
                      </span>
                      <span className={`self-center text-right text-sm tabular-nums whitespace-nowrap ${due.late ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {due.text}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Plate>
      </div>

      <ReceivablesPlate today={today} endDate={weekEnd} enabled={enabled} />
      <FollowUpsPlate today={today} endDate={weekEnd} enabled={enabled} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Plate
          id="dash-notifications"
          title="Notificações"
          meta={unreadCount.data ? plural(unreadCount.data, 'não lida', 'não lidas') : undefined}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/notificacoes">Ver todas</Link>
            </Button>
          }
        >
          {unread.isSuccess && unread.data.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhuma notificação não lida.</p>}
          {(unread.data?.length ?? 0) > 0 && (
            <ul>
              {unread.data!.map((n) => (
                <li key={n.id} className="border-b border-border last:border-b-0">
                  <Link to={notificationHref(n) ?? '/app/notificacoes'} className="flex min-h-11 flex-wrap items-center gap-x-3 py-2 hover:underline">
                    <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                    <span className="font-semibold">{n.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {n.body ? `${n.body} · ` : ''}
                      {formatDateTime(n.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Plate>

        <Plate id="dash-activity" title="Atividade recente">
          <ActivityFeed enabled={enabled} />
        </Plate>
      </div>
    </>
  )
}
