import { describe, expect, it } from 'vitest'
import { accessDefaults, accessFormSchema, accessPayload, builtinServices, isHttpUrl, mergeServiceSuggestions } from './schema'

describe('access schema', () => {
  it('exige o nome', () => {
    expect(accessFormSchema.safeParse(accessDefaults).success).toBe(false)
    expect(accessFormSchema.safeParse({ ...accessDefaults, name: 'Supabase' }).success).toBe(true)
  })

  it.each([
    ['https://supabase.com/dashboard', true],
    ['http://localhost:5173', true],
    ['HTTPS://Exemplo.com', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<b>x</b>', false],
    ['ftp://servidor', false],
    ['https://com espaço.com', false],
    ['supabase.com', false],
  ])('URL %s → %s', (url, ok) => {
    expect(isHttpUrl(url)).toBe(ok)
    expect(accessFormSchema.safeParse({ ...accessDefaults, name: 'X', url }).success).toBe(ok)
  })

  it('URL vazia é permitida', () => {
    expect(accessFormSchema.safeParse({ ...accessDefaults, name: 'X', url: '' }).success).toBe(true)
  })

  it('o payload troca vazio por null e apara o nome', () => {
    const p = accessPayload({ ...accessDefaults, name: '  Gmail  ', username: 'eu@exemplo.com' })
    expect(p).toEqual({
      name: 'Gmail',
      category: null,
      url: null,
      username: 'eu@exemplo.com',
      manager_item: null,
      project_id: null,
      client_id: null,
      notes: null,
    })
  })

  it('o schema não tem campo de senha', () => {
    expect(Object.keys(accessFormSchema.shape).join(',')).not.toMatch(/pass|senha|secret|token|key/i)
  })
})

describe('serviços sugeridos', () => {
  it('sem histórico, mostra os comuns', () => {
    const r = mergeServiceSuggestions([])
    expect(r.map((s) => s.name)).toEqual(builtinServices.map((s) => s.name))
    expect(r.every((s) => s.url === '' || isHttpUrl(s.url))).toBe(true)
  })

  it('os já cadastrados vêm primeiro, sem repetir o nome (maiúsculas e espaços não contam) e com os dados do registro mais recente', () => {
    const r = mergeServiceSuggestions([
      { name: 'Meu painel', category: 'Ferramenta', url: 'https://painel.exemplo.com' },
      { name: ' supabase ', category: 'Banco de dados', url: 'https://supabase.com/dashboard/project/x' },
      { name: 'SUPABASE', category: 'Outro', url: '' },
    ])
    expect(r.slice(0, 2)).toEqual([
      { name: 'Meu painel', category: 'Ferramenta', url: 'https://painel.exemplo.com' },
      { name: 'supabase', category: 'Banco de dados', url: 'https://supabase.com/dashboard/project/x' },
    ])
    expect(r.filter((s) => s.name.toLowerCase() === 'supabase')).toHaveLength(1)
    expect(r.some((s) => s.name === 'GitHub')).toBe(true)
  })
})
