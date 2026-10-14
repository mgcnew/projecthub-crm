import { describe, expect, it } from 'vitest'
import { formatTaxId, isValidCnpj, isValidCpf, isValidTaxId, telUrl, whatsappUrl } from './documents'

describe('CPF e CNPJ', () => {
  it('valida CPF com e sem pontuação', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })

  it('valida CNPJ com e sem pontuação', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })

  it('isValidTaxId aceita um ou outro', () => {
    expect(isValidTaxId('529.982.247-25')).toBe(true)
    expect(isValidTaxId('11.222.333/0001-81')).toBe(true)
    expect(isValidTaxId('abc')).toBe(false)
  })

  it('formata pelo tamanho', () => {
    expect(formatTaxId('52998224725')).toBe('529.982.247-25')
    expect(formatTaxId('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatTaxId(' 12345 ')).toBe('12345')
  })
})

describe('telefone', () => {
  it('monta o link do WhatsApp', () => {
    expect(whatsappUrl('(11) 91234-5678')).toBe('https://wa.me/5511912345678')
    expect(whatsappUrl('+55 11 91234-5678')).toBe('https://wa.me/5511912345678')
    expect(whatsappUrl('+1 415 555 0100')).toBe('https://wa.me/14155550100')
    expect(whatsappUrl('123')).toBeNull()
  })

  it('monta o link tel:', () => {
    expect(telUrl('(11) 3456-7890')).toBe('tel:1134567890')
    expect(telUrl('+55 11 3456-7890')).toBe('tel:+551134567890')
    expect(telUrl('12')).toBeNull()
  })
})
