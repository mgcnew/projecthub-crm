import { describe, expect, it } from 'vitest'
import { withCurrentOption } from './option-list'

const acme = { id: 'c1', name: 'Acme' }
const beta = { id: 'c2', name: 'Beta' }

describe('withCurrentOption', () => {
  it('sem valor atual devolve a lista como está', () => {
    expect(withCurrentOption([acme], '', false, 'arquivado')).toEqual([acme])
    expect(withCurrentOption(undefined, '', true, 'arquivado')).toEqual([])
  })

  it('durante o carregamento mantém uma opção provisória com o id atual', () => {
    expect(withCurrentOption(undefined, 'c1', true, 'arquivado')).toEqual([{ id: 'c1', name: 'Carregando…' }])
  })

  it('ao carregar, a opção real usa o mesmo id (mesma key do React)', () => {
    const loading = withCurrentOption(undefined, 'c1', true, 'arquivado')
    const loaded = withCurrentOption([beta, acme], 'c1', false, 'arquivado')
    expect(loading[0].id).toBe('c1')
    expect(loaded.find((o) => o.id === 'c1')).toEqual(acme)
    expect(loaded).toHaveLength(2)
  })

  it('valor fora da lista (arquivado) aparece rotulado', () => {
    expect(withCurrentOption([beta], 'c1', false, 'Cliente atual (arquivado)')).toEqual([
      { id: 'c1', name: 'Cliente atual (arquivado)' },
      beta,
    ])
  })
})
