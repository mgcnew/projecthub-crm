import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Field } from '@/components/form'
import { FormDateField } from '@/components/form-fields'
import { controlClass, textareaClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { leadDefaults, leadFormSchema, stages, temperatures, type LeadFormValues } from './schema'

export function LeadForm({
  initial = leadDefaults,
  readOnly,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial?: LeadFormValues
  readOnly?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: LeadFormValues) => Promise<void>
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<LeadFormValues>({ resolver: zodResolver(leadFormSchema), defaultValues: initial })
  const stage = useWatch({ control, name: 'stage' })

  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof LeadFormValues) => errors[k]?.message
  const inv = (k: keyof LeadFormValues) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="company_name" label="Empresa *" error={err('company_name')}>
            <input id="company_name" autoComplete="off" className={controlClass} aria-invalid={inv('company_name')} {...register('company_name')} />
          </Field>
          <Field id="contact_name" label="Contato" error={err('contact_name')}>
            <input id="contact_name" autoComplete="off" className={controlClass} {...register('contact_name')} />
          </Field>
          <Field id="email" label="E-mail" error={err('email')}>
            <input id="email" type="email" autoComplete="off" className={controlClass} aria-invalid={inv('email')} {...register('email')} />
          </Field>
          <Field id="phone" label="Telefone" error={err('phone')} hint="Com DDD. Ex.: (11) 91234-5678">
            <input id="phone" type="tel" autoComplete="off" className={controlClass} aria-invalid={inv('phone')} {...register('phone')} />
          </Field>
          <Field id="website" label="Site" error={err('website')} hint="Comece com https://">
            <input id="website" type="url" inputMode="url" autoComplete="off" className={controlClass} aria-invalid={inv('website')} {...register('website')} />
          </Field>
          <Field id="segment" label="Segmento" error={err('segment')} hint="Ex.: restaurante, clínica, escritório">
            <input id="segment" autoComplete="off" className={controlClass} {...register('segment')} />
          </Field>
        </div>

        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="section-title pr-2">Prospecção</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="temperature" label="Temperatura" hint="Frio só recebe e-mail; WhatsApp a partir de morno.">
              <select id="temperature" className={controlClass} {...register('temperature')}>
                {Object.entries(temperatures).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="stage" label="Etapa">
              <select id="stage" className={controlClass} {...register('stage')}>
                {Object.entries(stages).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="next_contact_on" label="Próximo contato" error={err('next_contact_on')}>
              <FormDateField id="next_contact_on" control={control} name="next_contact_on" />
            </Field>
          </div>
          {stage === 'lost' && (
            <Field id="lost_reason" label="Motivo da perda" error={err('lost_reason')}>
              <input id="lost_reason" autoComplete="off" className={controlClass} {...register('lost_reason')} />
            </Field>
          )}
          <Field
            id="hook"
            label="Gancho"
            error={err('hook')}
            hint="Algo específico deste lead para a mensagem não parecer disparo: o que viu no site, o segmento, uma dor."
          >
            <textarea id="hook" className={`${textareaClass} min-h-20`} {...register('hook')} />
          </Field>
          <Field id="source" label="Origem *" error={err('source')} hint="De onde veio o contato (planilha, indicação, evento…)">
            <input id="source" autoComplete="off" className={controlClass} aria-invalid={inv('source')} {...register('source')} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="section-title pr-2">Endereço</legend>
          <Field id="address_line" label="Endereço" error={err('address_line')}>
            <input id="address_line" autoComplete="off" className={controlClass} {...register('address_line')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="city" label="Cidade" error={err('city')}>
              <input id="city" autoComplete="off" className={controlClass} {...register('city')} />
            </Field>
            <Field id="state" label="Estado" error={err('state')}>
              <input id="state" autoComplete="off" className={controlClass} {...register('state')} />
            </Field>
          </div>
        </fieldset>

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
