import { taskDefaults, taskFormSchema, taskPayload } from './schema'

describe('taskFormSchema', () => {
  it('aceita só o título', () => {
    expect(taskFormSchema.safeParse({ ...taskDefaults, title: 'Ligar' }).success).toBe(true)
  })
  it('exige a data quando o prazo é dia inteiro', () => {
    const r = taskFormSchema.safeParse({ ...taskDefaults, title: 'x', deadline_type: 'date' })
    expect(r.success).toBe(false)
  })
  it('rejeita estimativa zero ou não numérica', () => {
    expect(taskFormSchema.safeParse({ ...taskDefaults, title: 'x', estimated_minutes: '0' }).success).toBe(false)
    expect(taskFormSchema.safeParse({ ...taskDefaults, title: 'x', estimated_minutes: 'abc' }).success).toBe(false)
  })
})

describe('taskPayload', () => {
  it('envia somente um tipo de prazo (exclusivos)', () => {
    const p = taskPayload({
      ...taskDefaults,
      title: 'x',
      deadline_type: 'date',
      due_date: '2026-11-01',
      due_at: '2026-11-02T10:00',
    })
    expect(p.due_date).toBe('2026-11-01')
    expect(p.due_at).toBeNull()
  })
  it('limpa o prazo quando "sem prazo"', () => {
    const p = taskPayload({ ...taskDefaults, title: 'x', due_date: '2026-11-01', due_at: '2026-11-02T10:00' })
    expect(p.due_date).toBeNull()
    expect(p.due_at).toBeNull()
  })
})
