const fieldLabels: Record<string, string> = {
  title: 'título',
  name: 'nome',
  description: 'descrição',
  notes: 'notas',
  status: 'status',
  priority: 'prioridade',
  due_date: 'prazo',
  due_at: 'prazo',
  estimated_minutes: 'estimativa',
  project_id: 'projeto',
  client_id: 'cliente',
  parent_task_id: 'tarefa pai',
  meeting_id: 'reunião',
  assigned_to: 'responsável',
  starts_at: 'início',
  ends_at: 'fim',
  recurrence_rule_id: 'recorrência',
  archived_at: 'arquivamento',
  company_name: 'empresa',
  email: 'e-mail',
  phone: 'telefone',
  started_on: 'início previsto',
  target_date: 'data alvo',
}

const valueLabels: Record<string, string> = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
  planning: 'Planejamento',
  active: 'Ativo',
  on_hold: 'Em espera',
  completed: 'Concluído',
  inactive: 'Inativo',
  scheduled: 'Agendado',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

export type ActivityRow = {
  action: string
  changes: unknown
}

/** Rótulos dos campos alterados, sem repetir o mesmo rótulo (due_date/due_at). */
export function changedFields(changes: unknown): string[] {
  if (!changes || typeof changes !== 'object') return []
  const labels = Object.keys(changes as Record<string, unknown>).map((k) => fieldLabels[k] ?? k.replaceAll('_', ' '))
  return [...new Set(labels)]
}

function fromTo(changes: unknown, key: string) {
  const c = (changes as Record<string, { from?: unknown; to?: unknown }> | null)?.[key]
  if (!c) return null
  const label = (v: unknown) => (typeof v === 'string' ? (valueLabels[v] ?? v) : v == null ? '—' : String(v))
  return `${label(c.from)} → ${label(c.to)}`
}

/** Frase curta da atividade, sem o autor. */
export function describeActivity(row: ActivityRow): string {
  switch (row.action) {
    case 'created': {
      const title = (row.changes as { title?: string } | null)?.title
      return title ? `Criou “${title}”` : 'Criou o registro'
    }
    case 'archived':
      return 'Arquivou'
    case 'unarchived':
      return 'Desarquivou'
    case 'status_changed':
      return `Alterou o status: ${fromTo(row.changes, 'status') ?? ''}`.trim()
    default: {
      const fields = changedFields(row.changes)
      return fields.length ? `Alterou ${fields.join(', ')}` : 'Alterou o registro'
    }
  }
}
