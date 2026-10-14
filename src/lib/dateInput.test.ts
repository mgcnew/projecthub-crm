import { describe, expect, it } from 'vitest'
import {
  cleanTime,
  formatDate,
  formatDateTime,
  isValidISODate,
  maskDate,
  maskDateTime,
  parseDate,
  parseDateTime,
  parseTime,
} from './dateInput'

describe('parseDate', () => {
  it.each([
    ['15/11/2026', '2026-11-15'],
    ['5/1/2026', '2026-01-05'],
    ['15/11/26', '2026-11-15'],
    ['15-11-2026', '2026-11-15'],
    ['15112026', '2026-11-15'],
    ['2026-11-15', '2026-11-15'],
    ['29/02/2028', '2028-02-29'],
  ])('%s → %s', (text, iso) => expect(parseDate(text)).toBe(iso))

  it.each([['31/02/2026'], ['29/02/2026'], ['32/01/2026'], ['00/01/2026'], ['15/13/2026'], ['abc'], [''], ['2026-02-30']])(
    'recusa "%s"',
    (text) => expect(parseDate(text)).toBeNull(),
  )

  it('isValidISODate', () => {
    expect(isValidISODate('2026-12-31')).toBe(true)
    expect(isValidISODate('2026-12-32')).toBe(false)
    expect(isValidISODate('26-12-31')).toBe(false)
  })
})

describe('parseTime', () => {
  it.each([
    ['14:30', '14:30'],
    ['9:05', '09:05'],
    ['1430', '14:30'],
    ['930', '09:30'],
    ['9', '09:00'],
    ['14', '14:00'],
    ['14h', '14:00'],
    ['9h30', '09:30'],
    ['00:00', '00:00'],
    ['23:59', '23:59'],
  ])('%s → %s', (text, hm) => expect(parseTime(text)).toBe(hm))

  it.each([['24:00'], ['12:60'], ['2460'], ['abc'], [''], ['12:3']])('recusa "%s"', (text) =>
    expect(parseTime(text)).toBeNull(),
  )
})

describe('parseDateTime', () => {
  it.each([
    ['15/11/2026 14:30', '2026-11-15T14:30'],
    ['15/11/2026 9h30', '2026-11-15T09:30'],
    ['2026-11-15T14:30', '2026-11-15T14:30'],
    ['2026-11-15 14:30', '2026-11-15T14:30'],
    ['151120261430', '2026-11-15T14:30'],
  ])('%s → %s', (text, local) => expect(parseDateTime(text)).toBe(local))

  it.each([['15/11/2026'], ['15/11/2026 25:00'], ['31/02/2026 10:00'], ['só texto'], ['']])('recusa "%s"', (text) =>
    expect(parseDateTime(text)).toBeNull(),
  )
})

describe('formatação e máscara', () => {
  it('formata em pt-BR', () => {
    expect(formatDate('2026-11-15')).toBe('15/11/2026')
    expect(formatDate('')).toBe('')
    expect(formatDate('2026-02-30')).toBe('')
    expect(formatDateTime('2026-11-15T14:30')).toBe('15/11/2026 14:30')
    expect(formatDateTime('x')).toBe('')
  })

  it('máscara de data progressiva', () => {
    expect(maskDate('1')).toBe('1')
    expect(maskDate('151')).toBe('15/1')
    expect(maskDate('15112026')).toBe('15/11/2026')
    expect(maskDate('15/11/20269999')).toBe('15/11/2026')
    expect(maskDate('2026-11-15')).toBe('2026-11-15')
  })

  it('máscara de data e hora progressiva', () => {
    expect(maskDateTime('15112026')).toBe('15/11/2026')
    expect(maskDateTime('151120261')).toBe('15/11/2026 1')
    expect(maskDateTime('1511202614')).toBe('15/11/2026 14')
    expect(maskDateTime('151120261430')).toBe('15/11/2026 14:30')
    expect(maskDateTime('2026-11-15T14:30')).toBe('2026-11-15T14:30')
  })

  it('horário só é limpo', () => {
    expect(cleanTime('9h30x')).toBe('9h30')
    expect(cleanTime('14:30:99')).toBe('14:30')
  })
})
