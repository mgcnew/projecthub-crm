import { describe, expect, it } from 'vitest'
import { afterEach } from 'vitest'
import { LINES, NO_LINE, lineFor, lineInitial, setProjectOrder } from './lines'

afterEach(() => setProjectOrder([]))

describe('linhas de projeto', () => {
  it('é estável para o mesmo projeto e usa Prata sem projeto', () => {
    expect(lineFor('a1b2')).toBe(lineFor('a1b2'))
    expect(lineFor(null)).toBe(NO_LINE)
    expect(lineFor(undefined)).toBe(NO_LINE)
  })

  it('distribui projetos pela paleta e nunca usa vermelho', () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => lineFor(`projeto-${i}`).key))
    expect(used.size).toBe(LINES.length)
    expect(LINES.some((l) => /^#e|ee372f/i.test(l.color))).toBe(false)
  })

  it('inicial do selo', () => {
    expect(lineInitial('site institucional')).toBe('S')
    expect(lineInitial('  1ª fase')).toBe('1')
    expect(lineInitial('Ética')).toBe('É')
    expect(lineInitial('')).toBe('—')
  })
})

describe('registro de linhas', () => {
  it('sem colisão na ordem de criação até esgotar a paleta', () => {
    const ids = Array.from({ length: LINES.length }, (_, i) => `p${i}`)
    setProjectOrder(ids)
    expect(new Set(ids.map((id) => lineFor(id).key)).size).toBe(LINES.length)
    expect(lineFor('p0')).toBe(LINES[0])
  })

  it('projeto fora do registro cai no hash estável', () => {
    setProjectOrder(['a'])
    expect(lineFor('desconhecido')).toBe(lineFor('desconhecido'))
  })
})
