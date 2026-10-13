import { describe, expect, it } from 'vitest'
import { defaultDir, taskOrder } from './api'

describe('taskOrder', () => {
  it('prazo: crescente com "sem prazo" sempre no fim e desempate estável', () => {
    expect(taskOrder('prazo', 'asc')).toEqual([
      { column: 'due_date', ascending: true, nullsFirst: false },
      { column: 'due_at', ascending: true, nullsFirst: false },
      { column: 'created_at', ascending: false, nullsFirst: false },
      { column: 'id', ascending: true, nullsFirst: false },
    ])
    expect(taskOrder('prazo', 'desc')[0]).toEqual({ column: 'due_date', ascending: false, nullsFirst: false })
  })

  it('prioridade usa a coluna gerada e ordena do mais importante', () => {
    expect(taskOrder('prioridade', defaultDir.prioridade)[0]).toEqual({
      column: 'priority_rank',
      ascending: false,
      nullsFirst: false,
    })
  })

  it('título A–Z e criadas: mais recentes primeiro, sem desempate duplicado de created_at', () => {
    expect(taskOrder('titulo', 'asc')[0].column).toBe('title')
    const criada = taskOrder('criada', 'desc')
    expect(criada.map((o) => o.column)).toEqual(['created_at', 'id'])
    expect(criada[0].ascending).toBe(false)
  })
})
