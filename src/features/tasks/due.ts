import { daysBetween, dueDateOf, formatDate, formatTime, todayISO } from '@/lib/format'

/** Prazo legível e se está vencido (nunca só por cor: o texto diz "atrasada"). */
export function dueLabel(t: { due_date: string | null; due_at: string | null; status: string }) {
  const due = dueDateOf(t)
  if (!due) return { text: '—', late: false }
  const open = t.status === 'todo' || t.status === 'in_progress'
  const delta = daysBetween(todayISO(), due)
  const day = formatDate(due).slice(0, 5)
  const at = t.due_at ? ` ${formatTime(t.due_at)}` : ''
  if (open && (delta < 0 || (t.due_at && new Date(t.due_at).getTime() < Date.now())))
    return { text: delta < 0 ? `atrasada ${-delta} dia${delta === -1 ? '' : 's'}` : `atrasada · ${day}${at}`, late: true }
  if (delta === 0) return { text: `hoje${at}`, late: false }
  if (delta === 1) return { text: `amanhã${at}`, late: false }
  return { text: `${day}${at}`, late: false }
}

