import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyInput, parseMoney } from './money'

describe('parseMoney', () => {
  it.each([
    ['1.500,00', 150000],
    ['1500,5', 150050],
    ['1500.50', 150050],
    ['R$ 1.500', 150000],
    ['1,500.00', 150000],
    ['0,99', 99],
    ['2.000.000,10', 200000010],
    ['10', 1000],
    ['1.500', 150000],
    ['1500.5', 150050],
  ])('%s → %d centavos', (text, cents) => {
    expect(parseMoney(text)).toBe(cents)
  })

  it.each([[''], ['abc'], ['R$'], ['12,345'], ['10,999'], ['-5'], ['-0,01']])('rejeita "%s"', (text) => {
    expect(parseMoney(text)).toBeNull()
  })

  it('mais de 2 casas decimais é inválido', () => {
    expect(parseMoney('10,999')).toBeNull()
    expect(parseMoney('10,55')).toBe(1055)
  })

})

describe('formatMoney', () => {
  it('formata em pt-BR com a moeda do projeto', () => {
    expect(formatMoney(150000, 'BRL').replace(/\s/g, ' ')).toBe('R$ 1.500,00')
    expect(formatMoney(99, 'USD').replace(/\s/g, ' ')).toContain('0,99')
    expect(formatMoney(1050000, 'EUR')).toContain('10.500,00')
  })

  it('ida e volta com o texto editável', () => {
    for (const cents of [0, 1, 99, 100, 150050, 123456789]) {
      expect(parseMoney(formatMoneyInput(cents))).toBe(cents)
    }
    expect(formatMoneyInput(null)).toBe('')
  })
})
