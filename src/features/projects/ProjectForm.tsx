import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { withCurrentOption } from '@/components/option-list'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { useClientOptions } from '@/features/clients/api'
import { currencyLabels } from '@/lib/money'
import {
  billingModels,
  projectDefaults,
  projectFormSchema,
  projectPriorities,
  projectStatuses,
  type ProjectFormValues,
} from './schema'
import { FormDateField } from '@/components/form-fields'

export function ProjectForm({
  initial = projectDefaults,
  readOnly,
  submitLabel,
  serverError,
  lockCurrency,
  onSubmit,
}: {
  initial?: ProjectFormValues
  readOnly?: boolean
  /** Projeto com parcelas: a moeda não muda (o banco também recusa). */
  lockCurrency?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: ProjectFormValues) => Promise<void>
}) {
  const clients = useClientOptions(true)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues: initial })

  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof ProjectFormValues) => errors[k]?.message
  const inv = (k: keyof ProjectFormValues) => (errors[k] ? true : undefined)
  // Mantém o cliente atual (inclusive arquivado) com identidade estável durante o carregamento.
  const options = withCurrentOption(clients.data, initial.client_id, clients.isPending, 'Cliente atual (arquivado)')

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="name" label="Nome *" error={err('name')}>
          <input id="name" className={controlClass} aria-invalid={inv('name')} {...register('name')} />
        </Field>
        <Field id="client_id" label="Cliente" hint="Projetos podem existir sem cliente.">
          <select id="client_id" className={controlClass} {...register('client_id')}>
            <option value="">Sem cliente</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="status" label="Situação">
            <select id="status" className={controlClass} {...register('status')}>
              {Object.entries(projectStatuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="priority" label="Prioridade">
            <select id="priority" className={controlClass} {...register('priority')}>
              {Object.entries(projectPriorities).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="started_on" label="Início" error={err('started_on')}>
            <FormDateField id="started_on" control={control} name="started_on" />
          </Field>
          <Field id="target_date" label="Prazo" error={err('target_date')}>
            <FormDateField id="target_date" control={control} name="target_date" />
          </Field>
        </div>
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="section-title pr-2">Valor</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="contract_value" label="Valor do projeto" error={err('contract_value')} hint="Ex.: 5.000,00. Opcional.">
              <input
                id="contract_value"
                inputMode="decimal"
                autoComplete="off"
                className={controlClass}
                aria-invalid={inv('contract_value')}
                {...register('contract_value')}
              />
            </Field>
            <Field
              id="currency"
              label="Moeda"
              hint={lockCurrency ? 'Fixa: o projeto já tem parcelas.' : undefined}
            >
              <select id="currency" className={controlClass} disabled={lockCurrency} {...register('currency')}>
                {Object.entries(currencyLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="billing_model" label="Modelo de cobrança">
              <select id="billing_model" className={controlClass} {...register('billing_model')}>
                {Object.entries(billingModels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>
        <Field id="description" label="Descrição" error={err('description')}>
          <textarea id="description" className={textareaClass} {...register('description')} />
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
