import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { objectValidator, usePersistedState } from './usePersistedState'

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number'
const validate = objectValidator({ q: '', page: 0 }, { q: isStr, page: isNum })

beforeEach(() => localStorage.clear())

describe('usePersistedState', () => {
  it('usa o padrão sem valor salvo e grava ao alterar', () => {
    const { result } = renderHook(() => usePersistedState('k', { q: '', page: 0 }, validate))
    expect(result.current[0]).toEqual({ q: '', page: 0 })
    act(() => result.current[1]({ q: 'acme', page: 2 }))
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ q: 'acme', page: 2 })
  })

  it('restaura o valor salvo na próxima montagem', () => {
    localStorage.setItem('k', JSON.stringify({ q: 'beta', page: 1 }))
    const { result } = renderHook(() => usePersistedState('k', { q: '', page: 0 }, validate))
    expect(result.current[0]).toEqual({ q: 'beta', page: 1 })
  })

  it('valor corrompido ou com tipo errado cai no padrão campo a campo', () => {
    localStorage.setItem('k', '{{ não é json')
    expect(renderHook(() => usePersistedState('k', { q: '', page: 0 }, validate)).result.current[0]).toEqual({ q: '', page: 0 })
    localStorage.setItem('k', JSON.stringify({ q: 42, page: 3, extra: 'x' }))
    expect(renderHook(() => usePersistedState('k', { q: '', page: 0 }, validate)).result.current[0]).toEqual({ q: '', page: 3 })
  })

  it('reset volta ao padrão e remove a chave', () => {
    localStorage.setItem('k', JSON.stringify({ q: 'x', page: 1 }))
    const { result } = renderHook(() => usePersistedState('k', { q: '', page: 0 }, validate))
    act(() => result.current[2]())
    expect(result.current[0]).toEqual({ q: '', page: 0 })
    expect(localStorage.getItem('k')).toBeNull()
  })
})
