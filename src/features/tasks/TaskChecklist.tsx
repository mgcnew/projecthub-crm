import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RowCheckbox } from '@/components/RowCheckbox'
import { controlClass } from '@/components/form-styles'
import { ErrorState, LoadingState } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useApplyTemplate, useChecklist, useChecklistMutations, useChecklistTemplates } from './api'
import { QuickCapture } from './QuickCapture'

export function TaskChecklist({ taskId }: { taskId: string }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const items = useChecklist(taskId)
  const { add, toggle, remove } = useChecklistMutations(orgId, taskId)
  const templates = useChecklistTemplates(canWrite)
  const apply = useApplyTemplate(orgId, taskId)
  const [templateId, setTemplateId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = items.data ?? []
  const nextOrder = list.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
  const doneCount = list.filter((i) => i.is_completed).length

  return (
    <section aria-labelledby="checklist-h" className="space-y-3">
      <h2 id="checklist-h" className="text-lg font-semibold">
        Checklist {list.length > 0 && <span className="text-sm font-normal text-muted-foreground">({doneCount}/{list.length})</span>}
      </h2>

      {items.isPending && <LoadingState />}
      {items.isError && <ErrorState message="Não foi possível carregar o checklist." onRetry={() => items.refetch()} />}
      {items.isSuccess && list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
      {list.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {list.map((i) => (
            <li key={i.id} className="flex min-h-11 items-center gap-1 pr-4 pl-2">
              <RowCheckbox
                label={i.title}
                checked={i.is_completed}
                disabled={!canWrite}
                onChange={() => toggle.mutate({ id: i.id, value: !i.is_completed })}
              />
              <span className={i.is_completed ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>{i.title}</span>
              {canWrite && (
                <Button variant="ghost" size="sm" aria-label={`Remover ${i.title}`} onClick={() => remove.mutate(i.id)}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          <QuickCapture
            placeholder="Novo item do checklist"
            label="Novo item do checklist"
            onCreate={async (title) => void (await add.mutateAsync({ title, sortOrder: nextOrder }))}
          />
          {(templates.data ?? []).length > 0 && (
            <div className="flex gap-2">
              <select
                aria-label="Modelo de checklist"
                className={controlClass}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Aplicar modelo…</option>
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                className="h-11"
                disabled={!templateId || apply.isPending}
                onClick={async () => {
                  setError(null)
                  setMessage(null)
                  try {
                    const n = await apply.mutateAsync({ templateId, startOrder: nextOrder })
                    setMessage(`${n} ${n === 1 ? 'item copiado' : 'itens copiados'} do modelo.`)
                    setTemplateId('')
                  } catch {
                    setError('Não foi possível aplicar o modelo.')
                  }
                }}
              >
                Aplicar
              </Button>
            </div>
          )}
          {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </section>
  )
}
