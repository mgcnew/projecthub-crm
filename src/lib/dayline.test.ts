import { afterEach, describe, expect, it } from 'vitest'
import { setActiveTimezone } from './format'
import { layoutDay, type DayStop } from './dayline'

afterEach(() => setActiveTimezone(null))

const stop = (key: string, start: string, end: string, projectId: string | null = null): DayStop => ({
  key,
  title: key,
  start,
  end,
  href: `/app/agenda/${key}`,
  projectId,
  kind: 'event',
})

describe('layoutDay', () => {
  it('janela padrão 07h–20h e posições proporcionais no fuso de trabalho', () => {
    setActiveTimezone('UTC')
    const { placed, ticks } = layoutDay([stop('a', '2026-10-13T10:00:00Z', '2026-10-13T11:00:00Z')], null)
    // 07h→20h = 13h; 10h está a 3/13 do início
    expect(placed[0].from).toBeCloseTo((3 / 13) * 100, 3)
    expect(placed[0].to).toBeCloseTo((4 / 13) * 100, 3)
    expect(ticks[0]).toEqual({ h: 7, at: 0 })
  })

  it('amplia a janela para compromissos fora de 07h–20h', () => {
    setActiveTimezone('UTC')
    const { placed } = layoutDay([stop('cedo', '2026-10-13T05:30:00Z', '2026-10-13T06:00:00Z')], null)
    expect(placed[0].from).toBeCloseTo((30 / (15 * 60)) * 100, 3) // janela 05h–20h
  })

  it('estações próximas alternam o rótulo para baixo; distantes ficam em cima', () => {
    setActiveTimezone('UTC')
    const { placed } = layoutDay(
      [
        stop('a', '2026-10-13T10:00:00Z', '2026-10-13T10:30:00Z'),
        stop('b', '2026-10-13T10:30:00Z', '2026-10-13T11:00:00Z'),
        stop('c', '2026-10-13T16:00:00Z', '2026-10-13T17:00:00Z'),
      ],
      null,
    )
    expect(placed.map((p) => p.level)).toEqual([0, 1, 0])
  })

  it('marca "agora" só dentro da janela', () => {
    setActiveTimezone('UTC')
    expect(layoutDay([], 12 * 60).now).toBeCloseTo((5 / 13) * 100, 3)
    expect(layoutDay([], 23 * 60).now).toBeNull()
  })

  it('usa a hora de parede do fuso, não o UTC', () => {
    setActiveTimezone('America/Sao_Paulo')
    const { placed } = layoutDay([stop('a', '2026-10-13T13:00:00Z', '2026-10-13T14:00:00Z')], null)
    expect(placed[0].from).toBeCloseTo((3 / 13) * 100, 3) // 10:00 em São Paulo
  })
})

describe('nextStation', () => {
  it('aponta a próxima estação e os minutos até ela; reconhece a em andamento', async () => {
    const { nextStation } = await import('./dayline')
    const stops = [
      stop('kickoff', '2026-10-13T13:00:00Z', '2026-10-13T14:00:00Z'),
      stop('foco', '2026-10-13T16:00:00Z', '2026-10-13T17:30:00Z'),
    ]
    const r1 = nextStation(stops, '2026-10-13T14:39:00Z')
    expect(r1.current).toBeNull()
    expect(r1.next?.key).toBe('foco')
    expect(r1.minutes).toBe(81)
    const r2 = nextStation(stops, '2026-10-13T13:30:00Z')
    expect(r2.current?.key).toBe('kickoff')
    expect(r2.next?.key).toBe('foco')
    expect(nextStation(stops, '2026-10-13T18:00:00Z').next).toBeNull()
  })
})
