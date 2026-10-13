import { describe, expect, it } from 'vitest'
import { splitUpcoming } from './api'
import { newEventHref } from './links'

describe('newEventHref', () => {
  it('monta a URL de novo evento/reunião com vínculos', () => {
    expect(newEventHref('event', {})).toBe('/app/agenda/novo')
    expect(newEventHref('meeting', { projectId: 'p1', clientId: 'c1' })).toBe(
      '/app/agenda/novo?tipo=reuniao&projeto=p1&cliente=c1',
    )
    expect(newEventHref('event', { clientId: 'c1' })).toBe('/app/agenda/novo?cliente=c1')
  })
})

describe('splitUpcoming', () => {
  const ev = (id: string, start: string, end: string, rule: string | null = null) => ({
    id,
    title: id,
    event_type: 'event',
    starts_at: start,
    ends_at: end,
    timezone: 'UTC',
    recurrence_rule_id: rule,
  })
  const now = new Date('2026-10-13T12:00:00Z').getTime()

  it('separa próximos (ordem crescente) de anteriores e conta série recorrente como próxima', () => {
    const r = splitUpcoming(
      [
        ev('futuro-2', '2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z'),
        ev('passado', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
        ev('serie-antiga', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z', 'rule-1'),
        ev('futuro-1', '2026-10-14T10:00:00Z', '2026-10-14T11:00:00Z'),
        ev('em-andamento', '2026-10-13T11:00:00Z', '2026-10-13T13:00:00Z'),
      ],
      now,
    )
    expect(r.upcoming.map((e) => e.id)).toEqual(['serie-antiga', 'em-andamento', 'futuro-1', 'futuro-2'])
    expect(r.past.map((e) => e.id)).toEqual(['passado'])
    expect(r.total).toBe(5)
  })

  it('limita próximos a 6 e anteriores a 3', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      ev(`f${i}`, `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`, `2026-11-${String(i + 1).padStart(2, '0')}T11:00:00Z`),
    )
    const olds = Array.from({ length: 5 }, (_, i) => ev(`o${i}`, `2026-09-0${i + 1}T10:00:00Z`, `2026-09-0${i + 1}T11:00:00Z`))
    const r = splitUpcoming([...many, ...olds], now)
    expect(r.upcoming).toHaveLength(6)
    expect(r.past).toHaveLength(3)
  })
})
