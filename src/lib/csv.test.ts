import { describe, expect, it } from 'vitest'
import { decodeCsv, detectDelimiter, parseCsv } from './csv'

describe('parseCsv', () => {
  it('lê vírgula, aspas, aspas escapadas e quebra de linha entre aspas', () => {
    const text = 'empresa,obs\n"Padaria, Sol","diz ""oi""\nem duas linhas"\nOutra,ok\n'
    expect(parseCsv(text)).toEqual([
      ['empresa', 'obs'],
      ['Padaria, Sol', 'diz "oi"\nem duas linhas'],
      ['Outra', 'ok'],
    ])
  })

  it('lê ponto e vírgula (Excel pt-BR), CRLF e descarta linhas vazias', () => {
    const text = 'Empresa;Telefone\r\nPadaria Sol;(11) 91234-5678\r\n;\r\n\r\nMercado Lua;11 3456-7890'
    expect(parseCsv(text)).toEqual([
      ['Empresa', 'Telefone'],
      ['Padaria Sol', '(11) 91234-5678'],
      ['Mercado Lua', '11 3456-7890'],
    ])
  })

  it('apara espaços das células e lê tabulação', () => {
    expect(parseCsv('a\tb\n  x \t y ')).toEqual([
      ['a', 'b'],
      ['x', 'y'],
    ])
  })
})

describe('detectDelimiter', () => {
  it('escolhe o separador mais frequente fora de aspas', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('"a;b",c,d')).toBe(',')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
    expect(detectDelimiter('só uma coluna')).toBe(',')
  })
})

describe('decodeCsv', () => {
  it('lê UTF-8 com BOM e cai para Windows-1252 (Excel) quando preciso', () => {
    const utf8 = new TextEncoder().encode('\uFEFFSão Paulo')
    expect(decodeCsv(utf8.buffer)).toBe('São Paulo')
    const latin1 = new Uint8Array([0x53, 0xe3, 0x6f, 0x20, 0x50, 0x61, 0x75, 0x6c, 0x6f]) // "São Paulo" em Windows-1252
    expect(decodeCsv(latin1.buffer)).toBe('São Paulo')
  })
})
