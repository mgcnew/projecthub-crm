import { describe, expect, it } from 'vitest'
import { summarize, sumByCurrency } from './summary'

describe('summarize', () => {
  const today = '2026-11-10'
  const rows = [
    { amount_cents: 300000, status: 'paid', due_date: '2026-10-01' },
    { amount_cents: 200000, status: 'pending', due_date: '2026-11-05' }, // atrasada
    { amount_cents: 250000, status: 'pending', due_date: '2026-11-20' },
    { amount_cents: 250000, status: 'pending', due_date: '2026-12-20' },
    { amount_cents: 999999, status: 'cancelled', due_date: '2026-11-15' },
  ]

  it('totaliza previsto, recebido, a receber e em atraso ignorando canceladas', () => {
    const s = summarize(rows, 1000000, today)
    expect(s.scheduled).toBe(1000000)
    expect(s.received).toBe(300000)
    expect(s.pending).toBe(700000)
    expect(s.overdue).toBe(200000)
    expect(s.overdueCount).toBe(1)
    expect(s.nextDue).toBe('2026-11-20')
    expect(s.gap).toBe(0)
  })

  it('vencendo hoje ainda não está em atraso', () => {
    const s = summarize([{ amount_cents: 100, status: 'pending', due_date: today }], null, today)
    expect(s.overdue).toBe(0)
    expect(s.nextDue).toBe(today)
    expect(s.gap).toBeNull()
  })

  it('aponta quando as parcelas não fecham com o contrato', () => {
    expect(summarize(rows, 1200000, today).gap).toBe(200000)
    expect(summarize(rows, 900000, today).gap).toBe(-100000)
  })
})

describe('sumByCurrency', () => {
  it('não mistura moedas', () => {
    const m = sumByCurrency([
      { currency: 'BRL', amount_cents: 100 },
      { currency: 'USD', amount_cents: 50 },
      { currency: 'BRL', amount_cents: 25 },
    ])
    expect(m.get('BRL')).toBe(125)
    expect(m.get('USD')).toBe(50)
  })
})
