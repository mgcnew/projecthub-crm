import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authStorage,
  getRemember,
  getRememberedEmail,
  saveRememberedEmail,
  setRemember,
} from './authStorage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('authStorage', () => {
  it('por padrão lembra: grava em localStorage e lê de volta', () => {
    expect(getRemember()).toBe(true)
    authStorage.setItem('sb-token', 'abc')
    expect(localStorage.getItem('sb-token')).toBe('abc')
    expect(sessionStorage.getItem('sb-token')).toBeNull()
    expect(authStorage.getItem('sb-token')).toBe('abc')
  })

  it('sem lembrar: grava só em sessionStorage e remove a cópia antiga do localStorage', () => {
    localStorage.setItem('sb-token', 'velho')
    setRemember(false)
    authStorage.setItem('sb-token', 'novo')
    expect(sessionStorage.getItem('sb-token')).toBe('novo')
    expect(localStorage.getItem('sb-token')).toBeNull()
    expect(authStorage.getItem('sb-token')).toBe('novo')
  })

  it('lembrando de novo, a sessão volta para o localStorage', () => {
    setRemember(false)
    authStorage.setItem('sb-token', 'a')
    setRemember(true)
    authStorage.setItem('sb-token', 'b')
    expect(localStorage.getItem('sb-token')).toBe('b')
    expect(sessionStorage.getItem('sb-token')).toBeNull()
  })

  it('sessões antigas em localStorage continuam sendo lidas', () => {
    localStorage.setItem('sb-token', 'legado')
    expect(authStorage.getItem('sb-token')).toBe('legado')
  })

  it('removeItem limpa os dois lugares', () => {
    localStorage.setItem('sb-token', 'x')
    sessionStorage.setItem('sb-token', 'y')
    authStorage.removeItem('sb-token')
    expect(localStorage.getItem('sb-token')).toBeNull()
    expect(sessionStorage.getItem('sb-token')).toBeNull()
  })

  it('storage que lança erro não derruba nada', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(() => authStorage.setItem('k', 'v')).not.toThrow()
    expect(authStorage.getItem('k')).toBeNull()
    expect(getRemember()).toBe(true)
    expect(getRememberedEmail()).toBe('')
    expect(() => setRemember(false)).not.toThrow()
    expect(() => saveRememberedEmail('a@b.co')).not.toThrow()
  })
})

describe('e-mail lembrado', () => {
  it('guarda, devolve e esquece; nunca guarda senha', () => {
    expect(getRememberedEmail()).toBe('')
    saveRememberedEmail('eu@exemplo.com')
    expect(getRememberedEmail()).toBe('eu@exemplo.com')
    saveRememberedEmail(null)
    expect(getRememberedEmail()).toBe('')
    const all = JSON.stringify({ ...localStorage, ...sessionStorage })
    expect(all).not.toMatch(/senha|password/i)
  })
})
