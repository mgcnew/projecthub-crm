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
