import { describe, expect, it } from 'vitest'
import { dayLabel, monthGrid, monthLabel, sameMonth, shiftMonth, TIME_STEPS, weekdayOf } from './calendar'

describe('calendar', () => {
  it('a grade tem 42 dias, começa no domingo e cobre o mês', () => {
    const g = monthGrid('2026-10-14')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-09-27') // 1º de outubro de 2026 é quinta
    expect(weekdayOf(g[0])).toBe(0)
    expect(g).toContain('2026-10-01')
    expect(g).toContain('2026-10-31')
    expect(g[41]).toBe('2026-11-07')
  })

  it('mês que começa no domingo não ganha dias antes', () => {
    expect(monthGrid('2026-11-20')[0]).toBe('2026-11-01')
  })

  it('shiftMonth mantém o dia e limita ao fim do mês', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftMonth('2028-01-31', 1)).toBe('2028-02-29')
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15')
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15')
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('rótulos em pt-BR', () => {
    expect(monthLabel('2026-11-15')).toBe('novembro de 2026')
    expect(dayLabel('2026-11-05')).toBe('5 de novembro de 2026')
    expect(sameMonth('2026-11-01', '2026-11-30')).toBe(true)
    expect(sameMonth('2026-11-30', '2026-12-01')).toBe(false)
  })

  it('horários de 15 em 15 minutos', () => {
    expect(TIME_STEPS).toHaveLength(96)
    expect(TIME_STEPS[0]).toBe('00:00')
    expect(TIME_STEPS[37]).toBe('09:15')
    expect(TIME_STEPS[95]).toBe('23:45')
  })
})
