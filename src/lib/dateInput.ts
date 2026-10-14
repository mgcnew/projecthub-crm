const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' que existe no calendário (31/02 e 29/02 em ano comum são recusados). */
export function isValidISODate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1) return false
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate()
}

const toISO = (y: number, mo: number, d: number) => `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(d)}`

/**
 * Texto digitado → 'YYYY-MM-DD' ou null. Aceita 15/11/2026, 15/11/26, 15-11-2026, 15112026 e o ISO
 * 2026-11-15 (usado por testes e colagens).
 */
export function parseDate(text: string): string | null {
  const t = text.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return isValidISODate(t) ? t : null
  let m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t)
  if (!m) m = /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const iso = toISO(year, Number(m[2]), Number(m[1]))
  return isValidISODate(iso) ? iso : null
}

/** 14:30, 9:05, 1430, 930, 9, 14h, 9h30 → 'HH:mm' ou null. */
export function parseTime(text: string): string | null {
  const t = text.trim().toLowerCase().replace('h', ':')
  let h: number
  let m: number
  let r: RegExpExecArray | null
  if ((r = /^(\d{1,2}):(\d{2})$/.exec(t))) {
    h = Number(r[1])
    m = Number(r[2])
  } else if ((r = /^(\d{1,2}):?$/.exec(t))) {
    h = Number(r[1])
    m = 0
  } else if ((r = /^(\d{1,2})(\d{2})$/.exec(t))) {
    h = Number(r[1])
    m = Number(r[2])
  } else {
    return null
  }
  if (h > 23 || m > 59) return null
  return `${pad(h)}:${pad(m)}`
}

/** '15/11/2026 14:30', '2026-11-15T14:30', '2026-11-15 14:30' ou '151120261430' → 'YYYY-MM-DDTHH:mm'. */
export function parseDateTime(text: string): string | null {
  const t = text.trim()
  let datePart: string
  let timePart: string
  let m = /^(\d{4}-\d{2}-\d{2})[T\s](.+)$/.exec(t)
  if (m) {
    datePart = m[1]
    timePart = m[2]
  } else if ((m = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})$/.exec(t))) {
    datePart = `${m[1]}${m[2]}${m[3]}`
    timePart = `${m[4]}:${m[5]}`
  } else if ((m = /^(\S+)\s+(\S+)$/.exec(t))) {
    datePart = m[1]
    timePart = m[2]
  } else {
    return null
  }
  const d = parseDate(datePart)
  const h = parseTime(timePart)
  return d && h ? `${d}T${h}` : null
}

export function formatDate(iso: string) {
  if (!isValidISODate(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(local: string) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(local)
  if (!m) return ''
  const date = formatDate(m[1])
  return date ? `${date} ${m[2]}` : ''
}

const looksISO = (raw: string) => /^\d{4}-/.test(raw.trim())

/** Máscara progressiva dd/mm/aaaa (colagem em ISO passa direto). */
export function maskDate(raw: string) {
  if (looksISO(raw)) return raw.trim()
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Máscara progressiva dd/mm/aaaa hh:mm (colagem em ISO passa direto). */
export function maskDateTime(raw: string) {
  if (looksISO(raw)) return raw.trim()
  const d = raw.replace(/\D/g, '').slice(0, 12)
  const date = maskDate(d.slice(0, 8))
  if (d.length <= 8) return date
  const t = d.slice(8)
  return `${date} ${t.length <= 2 ? t : `${t.slice(0, 2)}:${t.slice(2)}`}`
}

/** Horário não recebe máscara (930 e 9h30 são ambíguos durante a digitação); só limpa caracteres. */
export const cleanTime = (raw: string) => raw.replace(/[^\d:hH]/g, '').slice(0, 5)
