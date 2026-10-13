import { afterEach, describe, expect, it } from 'vitest'
import {
  addDays,
  dateInTz,
  dayStartInstant,
  formatTime,
  fromLocalInput,
  setActiveTimezone,
  toLocalInput,
  zonedWallToInstant,
} from './format'

afterEach(() => setActiveTimezone(null))

describe('fuso de trabalho', () => {
  it('interpreta a hora de parede no fuso escolhido', () => {
    setActiveTimezone('America/Sao_Paulo')
    expect(fromLocalInput('2026-11-03T10:00')).toBe('2026-11-03T13:00:00.000Z')
    expect(toLocalInput('2026-11-03T13:00:00.000Z')).toBe('2026-11-03T10:00')
  })

  it('mantém a hora local através do horário de verão (America/New_York)', () => {
    // EDT (UTC-4) antes de 01/11/2026, EST (UTC-5) depois.
    expect(zonedWallToInstant('2026-10-31T09:00', 'America/New_York').toISOString()).toBe('2026-10-31T13:00:00.000Z')
    expect(zonedWallToInstant('2026-11-02T09:00', 'America/New_York').toISOString()).toBe('2026-11-02T14:00:00.000Z')
  })

  it('resolve a data e o início do dia pelo fuso, não pelo UTC', () => {
    setActiveTimezone('Asia/Tokyo')
    // 20:00Z do dia 12 já é dia 13 em Tóquio (UTC+9).
    expect(dateInTz('2026-10-12T20:00:00Z')).toBe('2026-10-13')
    expect(dayStartInstant('2026-10-13')).toBe('2026-10-12T15:00:00.000Z')
  })

  it('formata a hora no fuso de trabalho', () => {
    setActiveTimezone('UTC')
    expect(formatTime('2026-11-03T13:05:00Z')).toBe('13:05')
    setActiveTimezone('America/Sao_Paulo')
    expect(formatTime('2026-11-03T13:05:00Z')).toBe('10:05')
  })

  it('ida e volta preserva o valor digitado', () => {
    setActiveTimezone('Europe/Lisbon')
    const iso = fromLocalInput('2026-07-15T18:30')!
    expect(toLocalInput(iso)).toBe('2026-07-15T18:30')
  })

  it('aritmética de dias não depende do fuso', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('formatMinutes e prazos', () => {
  it('estimativas curtas', async () => {
    const { formatMinutes } = await import('./format')
    expect(formatMinutes(null)).toBe('—')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(90)).toBe('1h30')
  })
  it('dias entre datas atravessando o mês', async () => {
    const { daysBetween } = await import('./format')
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
    expect(daysBetween('2026-10-13', '2026-10-11')).toBe(-2)
  })
})
