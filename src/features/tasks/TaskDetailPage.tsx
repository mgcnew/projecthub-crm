import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityView, type EntityTab } from '@/components/entity/EntityView'
import { ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { TaskWorkBlocks } from '@/features/calendar/TaskWorkBlocks'
import { ActivityTimeline } from '@/features/activity/ActivityTimeline'
import { ReminderEditor } from '@/features/notifications/ReminderEditor'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { toLocalInput } from '@/lib/format'
import { useQuickCreateTask, useSubtasks, useTask, useUpdateTask } from './api'
import { QuickCapture } from './QuickCapture'
import { TaskChecklist } from './TaskChecklist'
import { TaskForm } from './TaskForm'
import { TaskPlanning } from './TaskPlanning'
import { taskStatuses } from './schema'

export function TaskDetailPage() {
  const { id = '' } = useParams()
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useTask(id)
  const update = useUpdateTask(id)
  const subtasks = useSubtasks(id)
  const createSub = useQuickCreateTask(orgId)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar a tarefa." onRetry={() => q.refetch()} />
  const t = q.data
  if (!t) return <ErrorState message="Tarefa não encontrada." />

  const mainTask = t.parent_task_id ? (
    <Link className="text-sm font-semibold text-primary-strong underline" to={`/app/tarefas/${t.parent_task_id}`}>
      Tarefa principal
    </Link>
  ) : null
  const closed = t.status === 'done' || t.status === 'cancelled'

  const tabs: EntityTab[] = [
    {
      id: 'detalhes',
      label: 'Detalhes',
      content: (
        <>
          {message && <p role="status" className="text-sm font-medium text-emerald-700">{message}</p>}
    <TaskForm
      key={t.updated_at}
      initial={{
        title: t.title,
        description: t.description ?? '',
        project_id: t.project_id ?? '',
        client_id: t.client_id ?? '',
        status: t.status as 'todo',
        priority: t.priority as 'medium',
        deadline_type: t.due_at ? 'datetime' : t.due_date ? 'date' : 'none',
        due_date: t.due_date ?? '',
        due_at: toLocalInput(t.due_at),
        estimated_minutes: t.estimated_minutes ? String(t.estimated_minutes) : '',
      }}
      readOnly={!canWrite}
      submitLabel="Salvar alterações"
      serverError={error}
      onSubmit={async (values) => {
        setError(null)
        setMessage(null)
        try {
          await update.mutateAsync(values)
          setMessage('Alterações salvas.')
        } catch {
          setError('Não foi possível salvar as alterações.')
        }
      }}
    />
        </>
      ),
    },
    {
      id: 'tempo',
      label: 'Tempo',
      content: (
        <>
          <TaskPlanning taskId={t.id} />
          <TaskWorkBlocks taskId={t.id} taskTitle={t.title} />
        </>
      ),
    },
    {
      id: 'lembretes',
      label: 'Lembretes',
      content: (
        <ReminderEditor
          kind="task"
          id={t.id}
          closedReason={closed ? 'Tarefas concluídas ou canceladas não geram novos avisos.' : undefined}
        />
      ),
    },
    {
      id: 'checklist',
      label: 'Checklist',
      badge: (subtasks.data ?? []).length > 0 ? `${(subtasks.data ?? []).length} sub` : undefined,
      content: (
        <>
          <TaskChecklist taskId={t.id} />
        <section aria-labelledby="subtasks-h" className="space-y-3">
          <h2 id="subtasks-h" className="section-title">
            Subtarefas
          </h2>
          {subtasks.isSuccess && subtasks.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma subtarefa.</p>
          )}
          {(subtasks.data ?? []).length > 0 && (
            <ul className="plate divide-y divide-border">
              {subtasks.data!.map((s) => (
                <li key={s.id}>
                  <Link to={`/app/tarefas/${s.id}`} className="flex min-h-11 items-center justify-between px-4 hover:bg-muted">
                    <span className={s.status === 'done' ? 'text-muted-foreground line-through' : ''}>{s.title}</span>
                    <StatusBadge tone={s.status === 'done' ? 'success' : 'neutral'}>
                      {taskStatuses[s.status as keyof typeof taskStatuses] ?? s.status}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canWrite && (
            <QuickCapture
              placeholder="Nova subtarefa"
              label="Nova subtarefa"
              onCreate={async (title) =>
                void (await createSub.mutateAsync({ title, parentTaskId: t.id, projectId: t.project_id }))
              }
            />
          )}
        </section>
        </>
      ),
    },
    { id: 'atividade', label: 'Atividade', content: <ActivityTimeline entityType="task" entityId={t.id} /> },
  ]

  return (
    <EntityView
      kind="Tarefa"
      title={t.title}
      description={mainTask}
      actions={
        <StatusBadge tone={t.status === 'done' ? 'success' : 'neutral'}>
          {taskStatuses[t.status as keyof typeof taskStatuses] ?? t.status}
        </StatusBadge>
      }
      tabs={tabs}
    />
  )
}
