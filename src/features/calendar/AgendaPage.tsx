import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayLine } from '@/components/DayLine'
import { Plate } from '@/components/Plate'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, dateInTz, dayStartInstant, formatDate, toISODate, todayISO } from '@/lib/format'
import { useOccurrences, useWorkBlockProjects } from './api'
import { occurrenceToStop } from './stops'

function mondayOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const shift = (date.getDay() + 6) % 7
  return toISODate(new Date(y, m - 1, d - shift))
}


export function AgendaPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()))

  const { from, to } = useMemo(() => {
    return { from: dayStartInstant(weekStart), to: dayStartInstant(addDays(weekStart, 7)) }
  }, [weekStart])

  const q = useOccurrences(from, to, Boolean(orgId))
  const blockProjects = useWorkBlockProjects(q.data)

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

  const today = todayISO()
  const freeDays = byDay.filter(([, items]) => items.length === 0).map(([d]) => weekdayShort(d))

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`Semana de ${formatDate(weekStart)} a ${formatDate(addDays(weekStart, 6))}`}
        actions={
          <>
            <span className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" onClick={() => setWeekStart(mondayOf(todayISO()))}>
                Esta semana
              </Button>
              <Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight aria-hidden="true" />
              </Button>
            </span>
            {canWrite && (
              <Button asChild>
                <Link to="/app/agenda/novo">Novo evento</Link>
              </Button>
            )}
          </>
        }
      />

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar a agenda." onRetry={() => q.refetch()} />}
      {q.isSuccess && total === 0 && (
        <EmptyState
          title="Nada agendado nesta semana"
          description="Reuniões, eventos e blocos de foco aparecem aqui, dia a dia."
          action={
            canWrite ? (
              <Button asChild variant="outline">
                <Link to="/app/agenda/novo">Novo evento</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {q.isSuccess && total > 0 && (
        <div className="space-y-4">
          {byDay
            .filter(([, items]) => items.length > 0)
            .map(([day, items]) => (
              <Plate
                key={day}
                id={`day-${day}`}
                title={longDay(day)}
                meta={
                  <>
                    {day === today && <span className="mr-2 font-bold text-destructive">Hoje</span>}
                    {items.length} {items.length === 1 ? 'compromisso' : 'compromissos'}
                    {items.some((o) => o.is_recurring) && ' · inclui série'}
                  </>
                }
              >
                <DayLine
                  stops={items.map((o) => occurrenceToStop(o, blockProjects.data))}
                  nowISO={day === today ? new Date().toISOString() : null}
                  label={`Compromissos de ${longDay(day)}`}
                />
              </Plate>
            ))}
          {freeDays.length > 0 && (
            <p className="text-sm text-muted-foreground">Sem compromissos: {freeDays.join(', ')}.</p>
          )}
        </div>
      )}
    </>
  )
}

function longDay(iso: string) {
  const raw = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
  return raw.replace('.', '')
}

function weekdayShort(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')
}
