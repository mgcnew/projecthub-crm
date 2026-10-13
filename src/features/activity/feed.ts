export type EntityType = 'task' | 'project' | 'client' | 'calendar_event'

export type FeedEntity = {
  title: string | null
  /** Projeto cuja linha colore o item (a própria linha, se for um projeto). */
  projectId: string | null
  /** Para eventos: reunião abre a tela da reunião. */
  eventType?: string | null
}

const typeLabel: Record<EntityType, string> = {
  task: 'Tarefa',
  project: 'Projeto',
  client: 'Cliente',
  calendar_event: 'Evento',
}

export function entityLabel(type: EntityType, eventType?: string | null) {
  if (type === 'calendar_event' && eventType === 'meeting') return 'Reunião'
  if (type === 'calendar_event' && eventType === 'work_block') return 'Bloco de foco'
  return typeLabel[type]
}

export function entityHref(type: EntityType, id: string, eventType?: string | null) {
  switch (type) {
    case 'task':
      return `/app/tarefas/${id}`
    case 'project':
      return `/app/projetos/${id}`
    case 'client':
      return `/app/clientes/${id}`
    case 'calendar_event':
      return eventType === 'meeting' ? `/app/reunioes/${id}` : `/app/agenda/${id}`
  }
}

/** Tempo relativo curto, em pt-BR: "agora", "há 5 min", "há 3 h", "ontem", "12/10". */
export function relativeTime(iso: string, now: Date = new Date()) {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  if (h < 48) return 'ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
