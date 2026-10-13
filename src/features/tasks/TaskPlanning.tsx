import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate, todayISO } from '@/lib/format'
import { usePlanMutations, useTaskPlans } from './api'

/** Dia planejado: independente do prazo (D003). */
export function TaskPlanning({ taskId }: { taskId: string }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const plans = useTaskPlans(taskId)
  const { add, remove } = usePlanMutations(orgId)
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)

  return (
    <section aria-labelledby="planning-h" className="space-y-3">
      <h2 id="planning-h" className="text-lg font-semibold">
        Planejamento
      </h2>
      {plans.isSuccess && plans.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Não planejada para nenhum dia.</p>
      )}
      {(plans.data ?? []).length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {plans.data!.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm">
              {formatDate(p.planned_date)}
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover plano de ${formatDate(p.planned_date)}`}
                  onClick={() => remove.mutate(p.id)}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="Dia planejado"
            className={controlClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={!date || add.isPending}
            onClick={async () => {
              setError(null)
              try {
                await add.mutateAsync({ taskId, date })
              } catch (e) {
                const code = (e as { code?: string }).code
                setError(code === '23505' ? 'A tarefa já está planejada para esse dia.' : 'Não foi possível planejar.')
              }
            }}
          >
            Planejar
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
