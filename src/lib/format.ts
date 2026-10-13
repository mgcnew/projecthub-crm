// ---------------------------------------------------------------- fuso de trabalho
// O fuso do usuário (user_preferences.timezone, D054) interpreta toda data/hora digitada e exibida.
// É um estado de módulo para não passar o fuso por cada função; o TimezoneBoundary o define antes de
// renderizar as telas e remonta a árvore quando muda.
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
let activeZone: string | null = null

export const browserTimezone = browserZone
export const activeTimezone = () => activeZone ?? browserZone()
export function setActiveTimezone(tz: string | null) {
  activeZone = tz
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Componentes de data/hora de um instante no fuso `tz`. */
function zonedParts(ts: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour'), mm: get('minute'), ss: get('second') }
}

/** Deslocamento (ms) de `tz` em relação ao UTC no instante `ts`. */
function offsetAt(ts: number, tz: string) {
  const p = zonedParts(ts, tz)
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(ts / 1000) * 1000
}

/** 'YYYY-MM-DDTHH:mm' (hora de parede em `tz`) → instante. Dois passos resolvem a virada do horário de verão. */
export function zonedWallToInstant(local: string, tz: string): Date {
  const [d, t = '00:00'] = local.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, day, hh, mm)
  if (Number.isNaN(guess)) return new Date(NaN)
  const first = guess - offsetAt(guess, tz)
  return new Date(guess - offsetAt(first, tz))
}

// ------------------------------------------------------------------ datas
/** Data 'YYYY-MM-DD' sem deslocamento de fuso. */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: activeTimezone() })
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: activeTimezone(),
  })
}

/** Remove caracteres que quebram filtros do PostgREST ou viram curingas do LIKE. */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()%_\\*]/g, ' ').trim()
}

export const emptyToNull = (v: string | undefined | null) => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** 'YYYY-MM-DD' de um objeto Date pelos getters locais; serve à aritmética de calendário (addDays etc.). */
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' do dia em que o instante cai no fuso de trabalho. */
export function dateInTz(value: string | Date) {
  const p = zonedParts(new Date(value).getTime(), activeTimezone())
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

/** Hoje no fuso de trabalho. */
export function todayISO() {
  return dateInTz(new Date())
}

export function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + delta))
}

/** Instante (ISO UTC) em que o dia 'YYYY-MM-DD' começa no fuso de trabalho. */
export function dayStartInstant(dateISO: string) {
  return zonedWallToInstant(`${dateISO}T00:00`, activeTimezone()).toISOString()
}

/** ISO (timestamptz) → valor de <input type="datetime-local"> no fuso de trabalho. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const p = zonedParts(new Date(iso).getTime(), activeTimezone())
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`
}

/** Valor de <input type="datetime-local"> (hora de parede no fuso de trabalho) → ISO UTC. */
export function fromLocalInput(value: string) {
  if (!value) return null
  const at = zonedWallToInstant(value, activeTimezone())
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/** Estimativa curta: "45 min", "1 h", "1h30". */
export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD' (b − a). */
export function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Data do prazo de uma tarefa (dia inteiro ou com hora) no fuso de trabalho. */
export function dueDateOf(t: { due_date: string | null; due_at: string | null }) {
  return t.due_at ? dateInTz(t.due_at) : t.due_date
}
