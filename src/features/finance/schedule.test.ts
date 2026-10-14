import { describe, expect, it } from 'vitest'
import { addMonthsISO, generateSchedule } from './schedule'

const sum = (xs: { amount_cents: number }[]) => xs.reduce((n, x) => n + x.amount_cents, 0)

describe('addMonthsISO', () => {
  it('mantém o dia e limita ao fim do mês', () => {
    expect(addMonthsISO('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsISO('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsISO('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonthsISO('2026-12-10', 1)).toBe('2027-01-10')
  })
})

describe('generateSchedule', () => {
  const base = { advanceDue: '2026-11-01', firstDue: '2026-12-05' }

  it('sinal de 30% + 3 parcelas: a soma fecha exatamente no total', () => {
    const plan = generateSchedule({ ...base, totalCents: 1000000, advancePercent: 30, installments: 3 })
    expect(plan.map((p) => p.kind)).toEqual(['advance', 'installment', 'installment', 'final'])
    expect(plan[0].amount_cents).toBe(300000)
    expect(sum(plan)).toBe(1000000)
    expect(plan.map((p) => p.due_date)).toEqual(['2026-11-01', '2026-12-05', '2027-01-05', '2027-02-05'])
  })

  it('centavos que sobram vão para a última parcela', () => {
    const plan = generateSchedule({ ...base, totalCents: 100000, advancePercent: 0, installments: 3 })
    expect(plan.map((p) => p.amount_cents)).toEqual([33333, 33333, 33334])
    expect(sum(plan)).toBe(100000)
  })

  it('sem sinal e uma parcela vira um saldo único', () => {
    const plan = generateSchedule({ ...base, totalCents: 50000, advancePercent: 0, installments: 1 })
    expect(plan).toEqual([{ kind: 'final', description: 'Saldo', amount_cents: 50000, due_date: '2026-12-05' }])
  })

  it('100% de sinal gera só o adiantamento', () => {
    const plan = generateSchedule({ ...base, totalCents: 50000, advancePercent: 100, installments: 4 })
    expect(plan.map((p) => p.kind)).toEqual(['advance'])
    expect(sum(plan)).toBe(50000)
  })

  it('total inválido não gera nada', () => {
    expect(generateSchedule({ ...base, totalCents: 0, advancePercent: 10, installments: 2 })).toEqual([])
  })
})
