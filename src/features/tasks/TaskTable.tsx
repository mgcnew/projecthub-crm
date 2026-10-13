import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LineBadge } from '@/components/LineBadge'
import { RowCheckbox } from '@/components/RowCheckbox'
import { StatusBadge } from '@/components/states'
import { formatMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dueLabel } from './due'
import { taskPriorities, taskStatuses } from './schema'

export type TaskRowData = {
  id: string
  title: string
  status: string
  priority?: string
  due_date: string | null
  due_at: string | null
  estimated_minutes?: number | null
  project_id: string | null
  projectName?: string | null
}

const statusTone: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  todo: 'neutral',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
}

/**
 * Tabela de tarefas no vocabulário da sinalização: filete de 2px em tinta sob o cabeçalho, selo de
 * linha do projeto, prazo e estimativa em números tabulares. Abaixo de 768px as colunas viram uma
 * linha de metadados sob o título.
 */
export function TaskTable({
  rows,
  caption,
  canWrite,
  onToggle,
  pending,
  showEstimate = true,
  showPriority = false,
  showStatus = true,
  actions,
}: {
  rows: TaskRowData[]
  caption: string
  canWrite: boolean
  onToggle: (task: TaskRowData, done: boolean) => void
  pending?: boolean
  showEstimate?: boolean
  showPriority?: boolean
  showStatus?: boolean
  actions?: (task: TaskRowData) => ReactNode
}) {
  return (
    <table className="w-full border-collapse text-sm md:table-fixed">
      <caption className="sr-only">{caption}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b-2 border-rule-strong text-left text-xs font-semibold text-muted-foreground">
          <th scope="col" className="w-11 py-2"><span className="sr-only">Concluir</span></th>
          <th scope="col" className="w-12 py-2">Linha</th>
          <th scope="col" className="py-2">Tarefa</th>
          <th scope="col" className="w-28 py-2">Prazo</th>
          {showEstimate && <th scope="col" className="w-20 py-2">Estimativa</th>}
          {showPriority && <th scope="col" className="w-28 py-2">Prioridade</th>}
          {showStatus && <th scope="col" className="w-28 py-2">Situação</th>}
          {actions && <th scope="col" className="w-44 py-2"><span className="sr-only">Ações</span></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const done = t.status === 'done'
          const due = dueLabel(t)
          return (
            <tr key={t.id} className="border-b border-border align-middle last:border-b-0 md:last:border-b">
              <td className="w-11 py-1 md:py-0.5">
                <RowCheckbox
                  label={`Concluir ${t.title}`}
                  checked={done}
                  disabled={!canWrite || pending}
                  onChange={() => onToggle(t, !done)}
                />
              </td>
              <td className="hidden py-1 md:table-cell">
                <LineBadge projectId={t.project_id} projectName={t.projectName} />
              </td>
              <td className="py-2 pr-3 md:py-1">
                <Link
                  to={`/app/tarefas/${t.id}`}
                  className={cn('flex min-h-11 flex-col justify-center hover:underline md:min-h-10', done && 'text-muted-foreground line-through')}
                >
                  <span className="font-semibold">{t.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground no-underline md:hidden">
                    <LineBadge projectId={t.project_id} projectName={t.projectName} size="sm" />
                    {t.projectName ?? 'Sem projeto'}
                    {due.text !== '—' && <span className={cn(due.late && 'font-semibold text-destructive')}>· {due.text}</span>}
                    {showEstimate && t.estimated_minutes ? <span>· {formatMinutes(t.estimated_minutes)}</span> : null}
                  </span>
                  {t.projectName && (
                    <span className="hidden text-xs text-muted-foreground md:block">{t.projectName}</span>
                  )}
                </Link>
                {actions && <div className="-ml-3 md:hidden">{actions(t)}</div>}
              </td>
              <td className={cn('hidden py-1 tabular-nums md:table-cell', due.late && 'font-semibold text-destructive')}>
                {due.text}
              </td>
              {showEstimate && (
                <td className="hidden py-1 tabular-nums md:table-cell">{formatMinutes(t.estimated_minutes)}</td>
              )}
              {showPriority && (
                <td className="hidden py-1 md:table-cell">
                  <StatusBadge tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral'}>
                    {taskPriorities[t.priority as keyof typeof taskPriorities] ?? t.priority}
                  </StatusBadge>
                </td>
              )}
              {showStatus && (
                <td className="hidden py-1 md:table-cell">
                  <StatusBadge tone={statusTone[t.status] ?? 'neutral'}>
                    {taskStatuses[t.status as keyof typeof taskStatuses] ?? t.status}
                  </StatusBadge>
                </td>
              )}
              {actions && <td className="hidden py-2 text-right md:table-cell">{actions(t)}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
