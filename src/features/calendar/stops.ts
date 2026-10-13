import type { DayStop } from '@/lib/dayline'

type Occurrence = {
  event_id: string
  occurrence_start: string
  occurrence_end: string
  title: string
  event_type: string
  project_id: string | null
  task_id: string | null
}

/** Ocorrência da agenda → estação da Linha do dia (destino: reunião, tarefa do bloco ou evento). */
export function occurrenceToStop(o: Occurrence, taskProjects?: Map<string, string | null>): DayStop {
  return {
    key: `${o.event_id}-${o.occurrence_start}`,
    title: o.title,
    start: o.occurrence_start,
    end: o.occurrence_end,
    projectId: o.project_id ?? (o.task_id ? (taskProjects?.get(o.task_id) ?? null) : null),
    kind: o.event_type as DayStop['kind'],
    href:
      o.event_type === 'meeting'
        ? `/app/reunioes/${o.event_id}`
        : o.event_type === 'work_block' && o.task_id
          ? `/app/tarefas/${o.task_id}`
          : `/app/agenda/${o.event_id}`,
  }
}
