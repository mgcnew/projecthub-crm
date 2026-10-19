import { describe, expect, it } from 'vitest'
import { normalizeRow, planImport, suggestMapping, type ExistingLead } from './plan'

describe('suggestMapping', () => {
  it('reconhece nomes comuns, com e sem acento, e não repete campo', () => {
    expect(suggestMapping(['Nome da Empresa', 'Telefone', 'E-mail', 'Site', 'Endereço', 'Cidade', 'UF', 'Ramo', 'Celular', 'XYZ'])).toEqual([
      'company_name',
      'phone',
      'email',
      'website',
      'address_line',
      'city',
      'state',
      'segment',
      '',
      '',
    ])
  })
})

describe('normalizeRow', () => {
  it('normaliza telefone, e-mail, site e UF', () => {
    const r = normalizeRow({ company_name: ' Padaria Sol ', phone: '(11) 91234-5678', email: 'A@B.COM', website: 'padariasol.com.br', state: 'sp' })
    expect(r).toEqual({
      lead: { company_name: 'Padaria Sol', phone: '+5511912345678', email: 'a@b.com', website: 'https://padariasol.com.br', state: 'SP' },
    })
  })

  it.each([
    [{ phone: '11 1234' }, 'Sem o nome da empresa'],
    [{ company_name: 'X', email: 'sem-arroba' }, 'E-mail inválido'],
    [{ company_name: 'X', phone: '1234' }, 'Telefone inválido'],
    [{ company_name: 'X', website: 'javascript:alert(1)' }, 'Site inválido'],
    [{ company_name: 'X'.repeat(201) }, 'Empresa muito longo'],
  ])('recusa %o', (values, reason) => {
    const r = normalizeRow(values)
    expect('error' in r && r.error).toMatch(reason)
  })
})

describe('planImport', () => {
  const mapping = ['company_name', 'phone', 'email', 'city'] as const
  const rows = [
    ['Padaria Sol', '(11) 91234-5678', 'sol@x.com', ''], // 2: novo
    ['Mercado Lua', '', 'lua@x.com', 'Santos'], // 3: já existe (por e-mail), cidade vazia lá
    ['', '11 3456-7890', '', ''], // 4: erro (sem empresa)
    ['Sol de novo', '11912345678', '', ''], // 5: repetido no arquivo (telefone da linha 2)
    ['Bar Estrela', '1234', '', ''], // 6: erro (telefone)
  ]
  const existing: ExistingLead[] = [{ id: 'L1', company_name: 'Mercado Lua', email: 'lua@x.com', phone: null, city: null }]

  it('modo ignorar: novos entram, existentes e repetidos são ignorados, erros com o motivo', () => {
    const p = planImport(rows, [...mapping], existing, 'skip')
    expect(p.inserts.map((l) => [l.line, l.company_name, l.phone])).toEqual([[2, 'Padaria Sol', '+5511912345678']])
    expect(p.updates).toEqual([])
    expect(p.skipped.map((s) => s.line)).toEqual([3, 5])
    expect(p.skipped[1].reason).toMatch(/linha 2/)
    expect(p.errors.map((e) => e.line)).toEqual([4, 6])
  })

  it('modo completar: preenche só campos vazios do existente', () => {
    const p = planImport(rows, [...mapping], existing, 'fill')
    expect(p.updates).toEqual([{ id: 'L1', line: 3, patch: { city: 'Santos' } }])
    expect(p.skipped.map((s) => s.line)).toEqual([5])
  })

  it('nada a completar vira ignorado', () => {
    const p = planImport([['Mercado Lua', '', 'lua@x.com', '']], [...mapping], existing, 'fill')
    expect(p.updates).toEqual([])
    expect(p.skipped[0].reason).toMatch(/nada a completar/)
  })

  it('coluna ignorada não é lida', () => {
    const p = planImport([['Padaria', 'lixo']], ['company_name', ''], [], 'skip')
    expect(p.inserts).toEqual([{ company_name: 'Padaria', line: 2 }])
  })
})
