import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, formatDate, formatDateTime, todayISO } from '@/lib/format'
import {
  useDayPlans,
  useOpenTaskOptions,
  usePlanMutations,
  useQuickCreateTask,
  useSetTaskStatus,
} from './api'
import { QuickCapture } from './QuickCapture'
import { taskPriorities } from './schema'

type TaskRel = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  due_at: string | null
  projects: { name: string } | null
}

export function MyDayPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const [date, setDate] = useState(todayISO())
  const plans = useDayPlans(date, Boolean(orgId))
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
      <PageHeader title="Meu dia" description={isToday ? 'Hoje' : formatDate(date)} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
          ←
        </Button>
        <input type="date" aria-label="Dia" className={`${controlClass} w-auto`} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button variant="outline" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">
          →
        </Button>
        {!isToday && (
          <Button variant="ghost" onClick={() => setDate(todayISO())}>
            Hoje
          </Button>
        )}
      </div>

      {canWrite && (
        <div className="space-y-3">
          <QuickCapture
            placeholder="Nova tarefa para este dia"
            label="Nova tarefa para este dia"
            onCreate={async (title) => {
              const t = await create.mutateAsync({ title })
              await add.mutateAsync({ taskId: t.id, date, sortOrder: nextOrder })
            }}
          />
          <div className="flex gap-2">
            <select
              aria-label="Planejar tarefa existente"
              className={controlClass}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">Planejar tarefa existente…</option>
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
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {plans.isPending && <LoadingState />}
      {plans.isError && <ErrorState message="Não foi possível carregar o dia." onRetry={() => plans.refetch()} />}
      {plans.isSuccess && rows.length === 0 && (
        <EmptyState title="Nada planejado para este dia" description="Capture uma tarefa ou planeje uma existente." />
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {rows.map((r) => {
            const t = r.tasks as unknown as TaskRel | null
            if (!t) return null
            const done = t.status === 'done'
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <input
                  type="checkbox"
                  className="size-5"
                  aria-label={`Concluir ${t.title}`}
                  checked={done}
                  disabled={!canWrite}
                  onChange={() => setStatus.mutate({ id: t.id, status: done ? 'todo' : 'done' })}
                />
                <Link to={`/app/tarefas/${t.id}`} className="min-h-11 flex-1 content-center">
                  <span className={done ? 'text-muted-foreground line-through' : 'font-medium'}>{t.title}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {t.projects?.name ?? ''}
                    {(t.due_at || t.due_date) && ` · prazo ${t.due_at ? formatDateTime(t.due_at) : formatDate(t.due_date)}`}
                  </span>
                </Link>
                <StatusBadge tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'}>
                  {taskPriorities[t.priority as keyof typeof taskPriorities] ?? t.priority}
                </StatusBadge>
                {canWrite && (
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => run(() => move.mutateAsync({ id: r.id, date: addDays(date, 1) }), 'Não foi possível mover.')}
                    >
                      Amanhã
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => run(() => remove.mutateAsync(r.id), 'Não foi possível remover.')}
                    >
                      Remover
                    </Button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
