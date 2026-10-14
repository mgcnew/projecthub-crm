export type PaymentKind = 'advance' | 'installment' | 'final' | 'other'
export type PlannedPayment = { kind: PaymentKind; description: string; amount_cents: number; due_date: string }

/** Soma `months` meses a uma data ISO mantendo o dia, limitado ao último dia do mês (31/01 + 1 = 28/02). */
export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const total = m - 1 + months
  const year = y + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Sinal de `advancePercent`% (se > 0) + `installments` parcelas mensais do restante. Os centavos que
 * sobram da divisão vão para a última parcela, então a soma é sempre exatamente o total.
 */
export function generateSchedule(opts: {
  totalCents: number
  advancePercent: number
  installments: number
  advanceDue: string
  firstDue: string
}): PlannedPayment[] {
  const { totalCents, advancePercent, installments, advanceDue, firstDue } = opts
  if (!Number.isInteger(totalCents) || totalCents <= 0) return []
  const n = Math.max(1, Math.floor(installments))
  const pct = Math.min(Math.max(advancePercent, 0), 100)
  const advance = Math.round((totalCents * pct) / 100)
  const rest = totalCents - advance

  const out: PlannedPayment[] = []
  if (advance > 0) {
    out.push({ kind: 'advance', description: `Adiantamento (${pct}%)`, amount_cents: advance, due_date: advanceDue })
  }
  if (rest > 0) {
    const base = Math.floor(rest / n)
    for (let i = 0; i < n; i += 1) {
      const last = i === n - 1
      out.push({
        kind: last ? 'final' : 'installment',
        description: n === 1 ? 'Saldo' : `Parcela ${i + 1}/${n}`,
        amount_cents: last ? rest - base * (n - 1) : base,
        due_date: addMonthsISO(firstDue, i),
      })
    }
  }
  return out
}
