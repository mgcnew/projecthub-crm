import { addDays } from './format'

/** Semana de domingo a sábado, como nos calendários em pt-BR. */
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
export const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Dia da semana (0 = domingo) de uma data ISO. */
export const weekdayOf = (iso: string) => utc(iso).getUTCDay()

/** 42 datas (6 semanas) cobrindo o mês de `iso`, começando no domingo. */
export function monthGrid(iso: string): string[] {
  const [y, m] = iso.split('-').map(Number)
  const first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const start = addDays(first, -weekdayOf(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** Soma meses mantendo o dia, limitado ao último dia do mês de destino (31/01 + 1 = 28/02). */
export function shiftMonth(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = m - 1 + delta
  const year = y + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7)

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "novembro de 2026". */
export const monthLabel = (iso: string) => monthFmt.format(utc(iso))
/** "15 de novembro de 2026" (nome acessível do dia). */
export const dayLabel = (iso: string) => dayFmt.format(utc(iso))

/** Horários de 15 em 15 minutos, "00:00" a "23:45". */
export const TIME_STEPS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})
