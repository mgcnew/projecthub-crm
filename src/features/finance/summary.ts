export type PaymentLite = { amount_cents: number; status: string; due_date: string }

export type FinanceSummary = {
  /** Soma das parcelas não canceladas. */
  scheduled: number
  received: number
  pending: number
  /** A receber com vencimento anterior a `today` (derivado, no fuso de trabalho). */
  overdue: number
  overdueCount: number
  nextDue: string | null
  /** contrato − previsto; null sem valor de contrato. Positivo = falta programar; negativo = excede. */
  gap: number | null
}

export function summarize(payments: PaymentLite[], contractCents: number | null, today: string): FinanceSummary {
  let scheduled = 0
  let received = 0
  let pending = 0
  let overdue = 0
  let overdueCount = 0
  let nextDue: string | null = null
  for (const p of payments) {
    if (p.status === 'cancelled') continue
    scheduled += p.amount_cents
    if (p.status === 'paid') received += p.amount_cents
    if (p.status === 'pending') {
      pending += p.amount_cents
      if (p.due_date < today) {
        overdue += p.amount_cents
        overdueCount += 1
      } else if (nextDue === null || p.due_date < nextDue) {
        nextDue = p.due_date
      }
    }
  }
  return { scheduled, received, pending, overdue, overdueCount, nextDue, gap: contractCents === null ? null : contractCents - scheduled }
}

/** Soma por moeda: valores de moedas diferentes nunca são somados entre si. */
export function sumByCurrency<T extends { currency: string; amount_cents: number }>(rows: T[]) {
  const out = new Map<string, number>()
  for (const r of rows) out.set(r.currency, (out.get(r.currency) ?? 0) + r.amount_cents)
  return out
}
