import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayLine } from '@/components/DayLine'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useOccurrences, useWorkBlockProjects } from '@/features/calendar/api'
import { occurrenceToStop } from '@/features/calendar/stops'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, dayStartInstant, formatMinutes, todayISO } from '@/lib/format'
import { useDayPlans, useOpenTaskOptions, usePlanMutations, useQuickCreateTask, useSetTaskStatus } from './api'
import { QuickCapture } from './QuickCapture'
import { TaskTable, type TaskRowData } from './TaskTable'

/** Capacidade de referência do dia (horas de trabalho) para a soma das estimativas. */
const DAY_CAPACITY_MIN = 6 * 60

type PlanTask = TaskRowData & { projects: { name: string } | null }

function longDate(iso: string) {
  const raw = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return raw.charAt(0).toLocaleUpperCase('pt-BR') + raw.slice(1)
}

export function MyDayPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [date, setDate] = useState(todayISO())
  const plans = useDayPlans(date, Boolean(orgId))
  const { from, to } = useMemo(() => ({ from: dayStartInstant(date), to: dayStartInstant(addDays(date, 1)) }), [date])
  const agenda = useOccurrences(from, to, Boolean(orgId))
  const blockProjects = useWorkBlockProjects(agenda.data)
  const options = useOpenTaskOptions(Boolean(orgId) && canWrite)
  const create = useQuickCreateTask(orgId)
  const { add, move, remove } = usePlanMutations(orgId)
  const setStatus = useSetTaskStatus()
  const [pick, setPick] = useState('')
  const [error, setError] = useState<string | null>(null)

  const rows = plans.data ?? []
  const planned = new Set(rows.map((r) => r.task_id))
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1
  const isToday = date === todayISO()
  const tasks: (TaskRowData & { planId: string })[] = rows
    .filter((r) => r.tasks)
    .map((r) => {
      const t = r.tasks as unknown as PlanTask
      return { ...t, projectName: t.projects?.name ?? null, planId: r.id }
    })
  const remaining = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const estimate = remaining.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)
  const over = estimate > DAY_CAPACITY_MIN

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      const code = (e as { code?: string }).code
      setError(code === '23505' ? 'A tarefa já está planejada para esse dia.' : fallback)
    }
  }

  return (
    <>
      <PageHeader
        title="Meu dia"
        description={isToday ? `Hoje · ${longDate(date)}` : longDate(date)}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <input
              type="date"
              aria-label="Dia"
              className={`${controlClass} h-9 w-auto max-lg:h-11`}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">
              <ChevronRight aria-hidden="true" />
            </Button>
            {!isToday && (
              <Button variant="ghost" onClick={() => setDate(todayISO())}>
                Hoje
              </Button>
            )}
          </div>
        }
      />

      <Plate
        id="myday-line"
        title="Linha do dia"
        action={
          canWrite ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/agenda/novo">Novo evento</Link>
            </Button>
          ) : undefined
        }
      >
        {agenda.isPending ? (
          <LoadingState rows={1} />
        ) : (
          <DayLine
            stops={(agenda.data ?? []).map((o) => occurrenceToStop(o, blockProjects.data))}
            nowISO={isToday ? new Date().toISOString() : null}
            emptyText="Nenhum compromisso neste dia."
          />
        )}
      </Plate>

      <Plate
        id="myday-plan"
        title="Planejado"
        meta={
          tasks.length > 0 ? (
            <span className={over ? 'text-destructive' : undefined}>
              {formatMinutes(estimate)} de {formatMinutes(DAY_CAPACITY_MIN)}
              {over ? ' · o dia transborda' : ' · cabe no dia'}
            </span>
          ) : undefined
        }
      >
        {canWrite && (
          <div className="grid gap-3 pb-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <QuickCapture
              placeholder="Nova tarefa — só o título"
              label="Nova tarefa para este dia"
              onCreate={async (title) => {
                const t = await create.mutateAsync({ title })
                await add.mutateAsync({ taskId: t.id, date, sortOrder: nextOrder })
              }}
            />
            <div className="flex gap-2">
              <select aria-label="Planejar tarefa existente" className={controlClass} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Tarefa existente…</option>
                {(options.data ?? [])
                  .filter((o) => !planned.has(o.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                className="h-11"
                disabled={!pick || add.isPending}
                onClick={() =>
                  run(async () => {
                    await add.mutateAsync({ taskId: pick, date, sortOrder: nextOrder })
                    setPick('')
                  }, 'Não foi possível planejar a tarefa.')
                }
              >
                Planejar
              </Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="pb-3 text-sm font-medium text-destructive">{error}</p>}

        {plans.isPending && <LoadingState />}
        {plans.isError && <ErrorState message="Não foi possível carregar o dia." onRetry={() => plans.refetch()} />}
        {plans.isSuccess && tasks.length === 0 && (
          <EmptyState title="Nada planejado para este dia" description="Capture uma tarefa ou planeje uma existente. Planejar não muda o prazo." />
        )}
        {tasks.length > 0 && (
          <TaskTable
            rows={tasks}
            caption="Tarefas planejadas para o dia"
            canWrite={canWrite}
            pending={setStatus.isPending}
            onToggle={(t, done) => setStatus.mutate({ id: t.id, status: done ? 'done' : 'todo' })}
            actions={
              canWrite
                ? (t) => {
                    const planId = (t as TaskRowData & { planId: string }).planId
                    return (
                      <span className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => run(() => move.mutateAsync({ id: planId, date: addDays(date, 1) }), 'Não foi possível mover.')}>
                          Amanhã
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => run(() => remove.mutateAsync(planId), 'Não foi possível remover.')}>
                          Remover
                        </Button>
                      </span>
                    )
                  }
                : undefined
            }
          />
        )}
      </Plate>
    </>
  )
}
