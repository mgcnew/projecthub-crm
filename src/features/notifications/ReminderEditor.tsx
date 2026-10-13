import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useReminderMutations, useReminders, type ReminderTarget } from './api'
import { offsetLabel, reminderOffsets, validateReminderAt } from './schema'

/**
 * Lembretes de uma tarefa (instante absoluto) ou de um evento (antecedência aplicada a cada ocorrência).
 * O disparo é feito pelo servidor; a notificação aparece em /app/notificacoes.
 */
export function ReminderEditor({ kind, id, closedReason }: ReminderTarget & { closedReason?: string }) {
  const target = { kind, id }
  const { orgId, canWrite } = useCurrentWorkspace()
  const reminders = useReminders(target)
  const { create, remove } = useReminderMutations(orgId, target)
  const [at, setAt] = useState('')
  const [offset, setOffset] = useState('30')
  const [error, setError] = useState<string | null>(null)

  const fail = (e: unknown) => {
    const code = (e as { code?: string }).code
    if (code === '23505') setError('Esse lembrete já existe.')
    else if (code === '23514') setError('O lembrete deve ser no futuro.')
    else setError('Não foi possível salvar o lembrete.')
  }

  const add = async () => {
    setError(null)
    try {
      if (kind === 'task') {
        const invalid = validateReminderAt(at)
        if (invalid) return setError(invalid)
        await create.mutateAsync({ remindAt: at })
        setAt('')
      } else {
        await create.mutateAsync({ offsetMinutes: Number(offset) })
      }
    } catch (e) {
      fail(e)
    }
  }

  const rows = reminders.data ?? []

  return (
    <section aria-labelledby="reminders-h" className="space-y-3">
      <h2 id="reminders-h" className="section-title">
        Lembretes
      </h2>
      {closedReason && <p className="text-sm text-muted-foreground">{closedReason}</p>}
      {reminders.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os lembretes.</p>}
      {reminders.isSuccess && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum lembrete.</p>
      )}
      {rows.length > 0 && (
        <ul className="plate divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-11 items-center justify-between gap-2 px-4">
              <span className="text-sm">
                {r.remind_at ? formatDateTime(r.remind_at) : offsetLabel(r.offset_minutes ?? 0)}
              </span>
              {canWrite && (
                <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          {kind === 'task' ? (
            <Field id="reminder-at" label="Avisar em">
              <input
                id="reminder-at"
                type="datetime-local"
                className={controlClass}
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </Field>
          ) : (
            <Field id="reminder-offset" label="Avisar" hint="Vale para cada ocorrência, inclusive em séries.">
              <select
                id="reminder-offset"
                className={controlClass}
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
              >
                {reminderOffsets.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex items-end">
            <Button variant="outline" className="h-11 w-full" disabled={create.isPending} onClick={add}>
              Adicionar lembrete
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
