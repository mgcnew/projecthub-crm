import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['(11) 91234-5678', '+5511912345678'],
    ['11 3456-7890', '+551134567890'],
    ['011 91234-5678', '+5511912345678'],
    ['5511912345678', '+5511912345678'],
    ['+55 11 91234-5678', '+5511912345678'],
    ['0055 11 91234-5678', '+5511912345678'],
    ['+1 415 555 0100', '+14155550100'],
    ['(55) 91234-5678', '+5555912345678'],
  ])('%s → %s', (input, e164) => expect(normalizePhone(input)).toBe(e164))

  it.each([[''], ['   '], ['1234'], ['91234-5678'], ['+0 11 1234'], ['abc']])('recusa "%s"', (input) =>
    expect(normalizePhone(input)).toBeNull(),
  )
})

describe('formatPhone', () => {
  it('formata números brasileiros e mantém os demais', () => {
    expect(formatPhone('+5511912345678')).toBe('(11) 91234-5678')
    expect(formatPhone('+551134567890')).toBe('(11) 3456-7890')
    expect(formatPhone('+14155550100')).toBe('+14155550100')
    expect(formatPhone(null)).toBe('')
  })
})
