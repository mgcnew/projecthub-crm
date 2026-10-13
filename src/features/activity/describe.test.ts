import { describe, expect, it } from 'vitest'
import { changedFields, describeActivity } from './describe'

describe('describeActivity', () => {
  it('descreve criação com o título', () => {
    expect(describeActivity({ action: 'created', changes: { title: 'Enviar proposta' } })).toBe('criou “Enviar proposta”')
  })

  it('traduz a mudança de status', () => {
    expect(
      describeActivity({ action: 'status_changed', changes: { status: { from: 'todo', to: 'done' } } }),
    ).toBe('alterou o status: A fazer → Concluída')
  })

  it('lista campos alterados sem duplicar rótulos', () => {
    expect(changedFields({ due_date: { from: null, to: '2026-10-20' }, due_at: { from: null, to: null }, title: {} })).toEqual([
      'prazo',
      'título',
    ])
    expect(describeActivity({ action: 'updated', changes: { priority: { from: 'low', to: 'high' } } })).toBe(
      'alterou prioridade',
    )
  })

  it('arquivamento e desarquivamento', () => {
    expect(describeActivity({ action: 'archived', changes: {} })).toBe('arquivou')
    expect(describeActivity({ action: 'unarchived', changes: {} })).toBe('desarquivou')
  })

  it('tolera changes inesperado', () => {
    expect(describeActivity({ action: 'updated', changes: null })).toBe('alterou o registro')
  })
})
