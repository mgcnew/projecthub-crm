import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime, formatTime, fromLocalInput, todayISO } from '@/lib/format'
import { useCancelEvent, useCreateWorkBlock, useWorkBlocks } from './api'

/** Bloco de tempo: evento work_block da tarefa; independente do prazo e do dia planejado (D003/D004). */
export function TaskWorkBlocks({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const blocks = useWorkBlocks(taskId)
  const create = useCreateWorkBlock(orgId, taskId, taskTitle)
  const cancel = useCancelEvent()
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('09:00')
  const [minutes, setMinutes] = useState('60')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const mins = Number(minutes)
    if (!date || !time || !Number.isInteger(mins) || mins <= 0) {
      setError('Informe data, hora e duração em minutos.')
      return
    }
    const start = new Date(fromLocalInput(`${date}T${time}`)!)
    const end = new Date(start.getTime() + mins * 60_000)
    try {
      await create.mutateAsync({ startsAt: start.toISOString(), endsAt: end.toISOString() })
    } catch {
      setError('Não foi possível reservar o bloco.')
    }
  }

  return (
    <section aria-labelledby="blocks-h" className="space-y-3">
      <h2 id="blocks-h" className="text-lg font-semibold">
        Blocos de tempo
      </h2>
      {blocks.isSuccess && blocks.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum bloco reservado.</p>
      )}
      {(blocks.data ?? []).length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {blocks.data!.map((b) => (
            <li key={b.id} className="flex min-h-11 items-center justify-between gap-2 px-4">
              <span className="text-sm">
                {formatDateTime(b.starts_at)} → {formatTime(b.ends_at)}
              </span>
              {canWrite && (
                <Button variant="ghost" size="sm" onClick={() => cancel.mutate(b.id)}>
                  Cancelar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Field id="wb-date" label="Dia">
            <input id="wb-date" type="date" className={controlClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="wb-time" label="Início">
            <input id="wb-time" type="time" className={controlClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field id="wb-min" label="Duração (min)">
            <input id="wb-min" inputMode="numeric" className={controlClass} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="outline" className="h-11 w-full" disabled={create.isPending} onClick={submit}>
              Reservar bloco
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
