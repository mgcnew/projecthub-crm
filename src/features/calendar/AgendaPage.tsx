import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, dateInTz, dayStartInstant, formatDate, formatTime, toISODate, todayISO } from '@/lib/format'
import { useOccurrences } from './api'

function mondayOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const shift = (date.getDay() + 6) % 7
  return toISODate(new Date(y, m - 1, d - shift))
}

const timeFmt = formatTime

const typeLabel: Record<string, string> = { event: 'Evento', meeting: 'Reunião', work_block: 'Bloco de foco' }

export function AgendaPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()))

  const { from, to } = useMemo(() => {
    return { from: dayStartInstant(weekStart), to: dayStartInstant(addDays(weekStart, 7)) }
  }, [weekStart])

  const q = useOccurrences(from, to, Boolean(orgId))

  const data = q.data
  const byDay = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>>()
    for (let i = 0; i < 7; i++) map.set(addDays(weekStart, i), [])
    for (const o of data ?? []) {
      const key = dateInTz(o.occurrence_start)
      map.get(key)?.push(o)
    }
    return [...map.entries()]
  }, [data, weekStart])

  const total = (data ?? []).length

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`${formatDate(weekStart)} a ${formatDate(addDays(weekStart, 6))}`}
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/app/agenda/novo">Novo evento</Link>
            </Button>
          )
        }
      />

      <div className="flex gap-2">
        <Button variant="outline" aria-label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ←
        </Button>
        <Button variant="outline" onClick={() => setWeekStart(mondayOf(todayISO()))}>
          Esta semana
        </Button>
        <Button variant="outline" aria-label="Próxima semana" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          →
        </Button>
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar a agenda." onRetry={() => q.refetch()} />}
      {q.isSuccess && total === 0 && <EmptyState title="Nada agendado nesta semana" />}

      {q.isSuccess && total > 0 && (
        <div className="space-y-4">
          {byDay
            .filter(([, items]) => items.length > 0)
            .map(([day, items]) => (
              <section key={day} aria-label={formatDate(day)}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
                </h2>
                <ul className="divide-y divide-border rounded-md border border-border bg-card">
                  {items.map((o) => {
                    const href =
                      o.event_type === 'meeting'
                        ? `/app/reunioes/${o.event_id}`
                        : o.event_type === 'work_block' && o.task_id
                          ? `/app/tarefas/${o.task_id}`
                          : `/app/agenda/${o.event_id}`
                    return (
                      <li key={`${o.event_id}-${o.occurrence_start}`}>
                        <Link to={href} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted">
                          <span>
                            <span className="mr-3 text-sm tabular-nums text-muted-foreground">
                              {timeFmt(o.occurrence_start)}–{timeFmt(o.occurrence_end)}
                            </span>
                            <span className="font-medium">{o.title}</span>
                            {o.is_recurring && <span className="ml-2 text-xs text-muted-foreground">↻ repete</span>}
                          </span>
                          <StatusBadge tone={o.event_type === 'meeting' ? 'info' : o.event_type === 'work_block' ? 'success' : 'neutral'}>
                            {typeLabel[o.event_type] ?? o.event_type}
                          </StatusBadge>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}
    </>
  )
}
