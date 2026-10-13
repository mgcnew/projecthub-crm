import { describe, expect, it } from 'vitest'
import { patchTaskStatus } from './optimistic'

describe('patchTaskStatus', () => {
  it('troca o status em lista paginada, plano do dia e painel, sem tocar nos outros', () => {
    const list = { count: 2, rows: [{ id: 't1', status: 'todo', title: 'A' }, { id: 't2', status: 'todo', title: 'B' }] }
    const plan = [{ id: 'p1', task_id: 't1', tasks: { id: 't1', status: 'todo', title: 'A' } }]
    const dash = { rows: [{ id: 't1', status: 'in_progress' }], count: 1 }

    const l = patchTaskStatus(list, 't1', 'done')
    expect(l.rows[0].status).toBe('done')
    expect(l.rows[1]).toBe(list.rows[1]) // mesma referência: não re-renderiza o que não mudou
    expect(patchTaskStatus(plan, 't1', 'done')[0].tasks.status).toBe('done')
    expect(patchTaskStatus(plan, 't1', 'done')[0].id).toBe('p1') // o id do plano não é o da tarefa
    expect(patchTaskStatus(dash, 't1', 'done').rows[0].status).toBe('done')
  })

  it('devolve a mesma referência quando nada muda', () => {
    const data = { rows: [{ id: 't2', status: 'todo' }] }
    expect(patchTaskStatus(data, 't1', 'done')).toBe(data)
    expect(patchTaskStatus(data, 't2', 'todo')).toBe(data)
  })

  it('ignora valores primitivos e nulos', () => {
    expect(patchTaskStatus(null, 't1', 'done')).toBeNull()
    expect(patchTaskStatus('x', 't1', 'done')).toBe('x')
    expect(patchTaskStatus({ a: [1, 2, undefined] }, 't1', 'done')).toEqual({ a: [1, 2, undefined] })
  })
})
