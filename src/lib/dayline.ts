import { toLocalInput } from '@/lib/format'

export type DayStop = {
  key: string
  title: string
  start: string
  end: string
  href: string
  projectId: string | null
  kind: 'event' | 'meeting' | 'work_block'
}

/** Minutos desde a meia-noite (hora de parede no fuso de trabalho). */
export function wallMinutes(iso: string) {
  const [, t] = toLocalInput(iso).split('T')
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

type Placed = DayStop & { from: number; to: number; level: 0 | 1 }

/**
 * Janela do trilho: 07h–20h, ampliada para caber o primeiro e o último compromisso.
 * Estações próximas alternam o rótulo entre cima e baixo para não se sobreporem.
 */
export function layoutDay(stops: DayStop[], nowMinutes: number | null) {
  const sorted = [...stops].sort((a, b) => a.start.localeCompare(b.start))
  const mins = sorted.map((s) => wallMinutes(s.start))
  const ends = sorted.map((s, i) => Math.max(mins[i] + 15, wallMinutes(s.end) || 24 * 60))
  const startH = Math.max(0, Math.min(7, ...mins.map((m) => Math.floor(m / 60))))
  const endH = Math.min(24, Math.max(20, ...ends.map((m) => Math.ceil(m / 60))))
  const span = (endH - startH) * 60
  const pct = (m: number) => Math.min(100, Math.max(0, ((m - startH * 60) / span) * 100))

  const lastAt: [number, number] = [-100, -100]
  const placed: Placed[] = sorted.map((s, i) => {
    const from = pct(mins[i])
    const level: 0 | 1 = from - lastAt[0] < 17 ? 1 : 0
    lastAt[level] = from
    return { ...s, from, to: Math.max(from + 0.8, pct(ends[i])), level }
  })
  const ticks: number[] = []
  for (let h = startH; h <= endH; h += 1) if (h % 3 === 1 || h === startH) ticks.push(h)
  const now = nowMinutes !== null && nowMinutes >= startH * 60 && nowMinutes <= endH * 60 ? pct(nowMinutes) : null
  return { placed, ticks: [...new Set(ticks)].map((h) => ({ h, at: pct(h * 60) })), now }
}


/**
 * Leitura de sinalização "próxima estação": o compromisso em andamento (se houver) e o próximo a
 * começar depois de agora, com os minutos até ele.
 */
export function nextStation(stops: DayStop[], nowISO: string) {
  const now = new Date(nowISO).getTime()
  const sorted = [...stops].sort((a, b) => a.start.localeCompare(b.start))
  const current = sorted.find((s) => new Date(s.start).getTime() <= now && new Date(s.end).getTime() > now) ?? null
  const next = sorted.find((s) => new Date(s.start).getTime() > now) ?? null
  const minutes = next ? Math.max(1, Math.round((new Date(next.start).getTime() - now) / 60_000)) : null
  return { current, next, minutes }
}
