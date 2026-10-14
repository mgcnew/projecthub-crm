import { z } from 'zod'
import { emptyToNull } from '@/lib/format'
import { parseMoney } from '@/lib/money'

export const paymentKinds = { advance: 'Adiantamento', installment: 'Parcela', final: 'Saldo final', other: 'Avulso' } as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data')

export const paymentFormSchema = z.object({
  kind: z.enum(['advance', 'installment', 'final', 'other']),
  description: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  amount: z.string().trim().refine((v) => {
    const c = parseMoney(v)
    return c !== null && c > 0
  }, 'Informe um valor maior que zero. Ex.: 1.500,00'),
  due_date: isoDate,
  payment_method: z.string().trim().max(60, 'Máximo de 60 caracteres'),
  invoice_number: z.string().trim().max(60, 'Máximo de 60 caracteres'),
  notes: z.string().max(2000, 'Máximo de 2.000 caracteres'),
})
export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export const paymentDefaults = (due: string): PaymentFormValues => ({
  kind: 'installment',
  description: '',
  amount: '',
  due_date: due,
  payment_method: '',
  invoice_number: '',
  notes: '',
})

export function paymentPayload(v: PaymentFormValues) {
  return {
    kind: v.kind,
    description: emptyToNull(v.description),
    amount_cents: parseMoney(v.amount) as number,
    due_date: v.due_date,
    payment_method: emptyToNull(v.payment_method),
    invoice_number: emptyToNull(v.invoice_number),
    notes: emptyToNull(v.notes),
  }
}

export const generatorSchema = z.object({
  total: z.string().trim().refine((v) => {
    const c = parseMoney(v)
    return c !== null && c > 0
  }, 'Informe o valor total'),
  advance_percent: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 100), 'Use um número de 0 a 100'),
  installments: z.string().trim().refine((v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 60, 'Use de 1 a 60 parcelas'),
  advance_due: isoDate,
  first_due: isoDate,
})
export type GeneratorValues = z.infer<typeof generatorSchema>
