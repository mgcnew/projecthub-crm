/** Data 'YYYY-MM-DD' sem deslocamento de fuso. */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Remove caracteres que quebram filtros do PostgREST ou viram curingas do LIKE. */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()%_\\*]/g, ' ').trim()
}

export const emptyToNull = (v: string | undefined | null) => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** 'YYYY-MM-DD' do dia local (não UTC). */
export function toISODate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + delta))
}

/** ISO (timestamptz) → valor de <input type="datetime-local"> no fuso local. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null
}
