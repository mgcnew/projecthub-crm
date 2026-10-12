import { eventDefaults, eventFormSchema, rulePayload } from './schema'

const base = { ...eventDefaults('2026-11-02T09:00', '2026-11-02T10:00'), title: 'Reunião' }

describe('eventFormSchema', () => {
  it('aceita evento simples', () => {
    expect(eventFormSchema.safeParse(base).success).toBe(true)
  })
  it('rejeita fim anterior ou igual ao início', () => {
    expect(eventFormSchema.safeParse({ ...base, end_at: '2026-11-02T09:00' }).success).toBe(false)
  })
  it('semanal exige incluir o dia da semana do início (2026-11-02 é segunda = 1)', () => {
    const wrong = eventFormSchema.safeParse({ ...base, frequency: 'weekly', by_weekday: ['2', '4'] })
    expect(wrong.success).toBe(false)
    const ok = eventFormSchema.safeParse({ ...base, frequency: 'weekly', by_weekday: ['1', '3'] })
    expect(ok.success).toBe(true)
  })
  it('rejeita término da série antes do início', () => {
    const r = eventFormSchema.safeParse({ ...base, frequency: 'daily', ends_on: '2026-10-01' })
    expect(r.success).toBe(false)
  })
})

describe('rulePayload', () => {
  it('só envia dias da semana para frequência semanal', () => {
    expect(rulePayload({ ...base, frequency: 'daily', by_weekday: ['1'] }).by_weekday).toEqual([])
    expect(rulePayload({ ...base, frequency: 'weekly', by_weekday: ['1', '3'] }).by_weekday).toEqual([1, 3])
  })
})
