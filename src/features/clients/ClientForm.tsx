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
        <Field id="company_name" label="Empresa" error={err('company_name')}>
          <input id="company_name" className={controlClass} {...register('company_name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="email" label="E-mail" error={err('email')}>
            <input id="email" type="email" className={controlClass} aria-invalid={inv('email')} {...register('email')} />
          </Field>
          <Field id="phone" label="Telefone" error={err('phone')}>
            <input id="phone" type="tel" className={controlClass} {...register('phone')} />
          </Field>
        </div>
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
