/** Antecedências oferecidas para lembretes de evento (limite do banco: 0–10080 min). */
export const reminderOffsets = [
  { value: 0, label: 'No horário do evento' },
  { value: 5, label: '5 minutos antes' },
  { value: 10, label: '10 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 2880, label: '2 dias antes' },
  { value: 10080, label: '1 semana antes' },
] as const

export function offsetLabel(minutes: number) {
  return reminderOffsets.find((o) => o.value === minutes)?.label ?? `${minutes} minutos antes`
}

/** Valida o valor de <input type="datetime-local"> de um lembrete de tarefa. */
export function validateReminderAt(local: string, now: Date = new Date()): string | null {
  if (!local) return 'Informe a data e a hora do lembrete.'
  const at = new Date(local)
  if (Number.isNaN(at.getTime())) return 'Data e hora inválidas.'
  if (at.getTime() < now.getTime() - 60_000) return 'O lembrete deve ser no futuro.'
  return null
}

/** Destino de uma notificação: a tarefa ou o evento de origem (null se foram removidos). */
export function notificationHref(n: { task_id: string | null; event_id: string | null }) {
  if (n.task_id) return `/app/tarefas/${n.task_id}`
  if (n.event_id) return `/app/agenda/${n.event_id}`
  return null
}
