import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { paymentFormSchema, paymentKinds, type PaymentFormValues } from './schema'
import { FormDateField } from '@/components/form-fields'

/** Formulário de parcela (nova ou edição). O valor é digitado em formato brasileiro e vira centavos. */
export function PaymentForm({
  initial,
  currency,
  submitLabel,
  serverError,
  onSubmit,
  onCancel,
}: {
  initial: PaymentFormValues
  currency: string
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: PaymentFormValues) => Promise<void>
  onCancel: () => void
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({ resolver: zodResolver(paymentFormSchema), defaultValues: initial })
  const err = (k: keyof PaymentFormValues) => errors[k]?.message
  const inv = (k: keyof PaymentFormValues) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="plate space-y-4 p-4">
      <fieldset disabled={isSubmitting} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pay-kind" label="Tipo">
            <select id="pay-kind" className={controlClass} {...register('kind')}>
              {Object.entries(paymentKinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="pay-description" label="Descrição" error={err('description')}>
            <input id="pay-description" autoComplete="off" className={controlClass} {...register('description')} />
          </Field>
          <Field id="pay-amount" label={`Valor (${currency}) *`} error={err('amount')} hint="Ex.: 1.500,00">
            <input
              id="pay-amount"
              inputMode="decimal"
              autoComplete="off"
              className={controlClass}
              aria-invalid={inv('amount')}
              {...register('amount')}
            />
          </Field>
          <Field id="pay-due" label="Vencimento *" error={err('due_date')}>
            <FormDateField id="pay-due" control={control} name="due_date" clearable={false} />
          </Field>
          <Field id="pay-method" label="Forma de pagamento" error={err('payment_method')} hint="Pix, boleto, transferência…">
            <input id="pay-method" autoComplete="off" className={controlClass} {...register('payment_method')} />
          </Field>
          <Field id="pay-invoice" label="Nº da nota" error={err('invoice_number')}>
            <input id="pay-invoice" autoComplete="off" className={controlClass} {...register('invoice_number')} />
          </Field>
        </div>
        <Field id="pay-notes" label="Observações" error={err('notes')}>
          <textarea id="pay-notes" className={textareaClass} {...register('notes')} />
        </Field>
      </fieldset>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
