import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { clientDefaults, clientFormSchema, clientStatuses, type ClientFormValues } from './schema'

export function ClientForm({
  initial = clientDefaults,
  readOnly,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial?: ClientFormValues
  readOnly?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: ClientFormValues) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ClientFormValues>({ resolver: zodResolver(clientFormSchema), defaultValues: initial })

  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof ClientFormValues) => errors[k]?.message
  const inv = (k: keyof ClientFormValues) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="name" label="Nome *" error={err('name')}>
          <input id="name" className={controlClass} aria-invalid={inv('name')} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="company_name" label="Empresa" error={err('company_name')}>
            <input id="company_name" className={controlClass} {...register('company_name')} />
          </Field>
          <Field id="legal_name" label="Razão social" error={err('legal_name')}>
            <input id="legal_name" className={controlClass} {...register('legal_name')} />
          </Field>
          <Field id="tax_id" label="CPF ou CNPJ" error={err('tax_id')} hint="Para emitir nota e cobrar">
            <input
              id="tax_id"
              inputMode="numeric"
              autoComplete="off"
              className={controlClass}
              aria-invalid={inv('tax_id')}
              {...register('tax_id')}
            />
          </Field>
          <Field id="source" label="Origem" error={err('source')} hint="Indicação, rede social, site…">
            <input id="source" autoComplete="off" className={controlClass} {...register('source')} />
          </Field>
          <Field id="email" label="E-mail" error={err('email')}>
            <input id="email" type="email" className={controlClass} aria-invalid={inv('email')} {...register('email')} />
          </Field>
          <Field id="phone" label="Telefone" error={err('phone')}>
            <input id="phone" type="tel" className={controlClass} {...register('phone')} />
          </Field>
          <Field id="billing_email" label="E-mail de cobrança" error={err('billing_email')}>
            <input
              id="billing_email"
              type="email"
              className={controlClass}
              aria-invalid={inv('billing_email')}
              {...register('billing_email')}
            />
          </Field>
          <Field id="website" label="Site" error={err('website')} hint="Comece com https://">
            <input
              id="website"
              type="url"
              inputMode="url"
              autoComplete="off"
              className={controlClass}
              aria-invalid={inv('website')}
              {...register('website')}
            />
          </Field>
        </div>
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="section-title pr-2">Endereço</legend>
          <Field id="address_line" label="Endereço" error={err('address_line')}>
            <input id="address_line" autoComplete="off" className={controlClass} {...register('address_line')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="address_city" label="Cidade" error={err('address_city')}>
              <input id="address_city" autoComplete="off" className={controlClass} {...register('address_city')} />
            </Field>
            <Field id="address_state" label="Estado" error={err('address_state')}>
              <input id="address_state" autoComplete="off" className={controlClass} {...register('address_state')} />
            </Field>
            <Field id="address_postal_code" label="CEP" error={err('address_postal_code')}>
              <input
                id="address_postal_code"
                inputMode="numeric"
                autoComplete="off"
                className={controlClass}
                {...register('address_postal_code')}
              />
            </Field>
          </div>
        </fieldset>
        <Field id="status" label="Situação">
          <select id="status" className={controlClass} {...register('status')}>
            {Object.entries(clientStatuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="notes" label="Observações" error={err('notes')}>
          <textarea id="notes" className={textareaClass} {...register('notes')} />
        </Field>
      </fieldset>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      {!readOnly && (
        <Button type="submit" className="h-11" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
