import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { useLeadSamples, useProductOptions } from './api'
import { lintTemplate } from './lint'
import { PLACEHOLDERS } from './render'
import { channels, splitLines, stepLabels, templateDefaults, templateFormSchema, type TemplateFormValues } from './schema'
import { TemplatePreview } from './TemplatePreview'

export function TemplateForm({
  templateId,
  initial = templateDefaults,
  readOnly,
  submitLabel,
  serverError,
  onSubmit,
}: {
  /** Id real do modelo (a escolha das variações depende dele); modelo novo usa um id provisório. */
  templateId: string
  initial?: TemplateFormValues
  readOnly?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: TemplateFormValues) => Promise<void>
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TemplateFormValues>({ resolver: zodResolver(templateFormSchema), defaultValues: initial })
  useUnsavedChangesGuard(isDirty && !isSubmitting)
  const products = useProductOptions(true)
  const leads = useLeadSamples(true)
  const v = useWatch({ control })
  const channel = v.channel === 'whatsapp' ? 'whatsapp' : 'email'
  const step = Number(v.step ?? '1')
  const product = products.data?.find((p) => p.id === v.product_id) ?? null

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof TemplateFormValues) => errors[k]?.message
  const warnings = lintTemplate({
    channel,
    step,
    subject: channel === 'email' ? (v.subject ?? '') : null,
    body: v.body ?? '',
    openings: splitLines(v.openings ?? ''),
    closings: splitLines(v.closings ?? ''),
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="name" label="Nome do modelo *" error={err('name')} hint="Só para você achar depois. Ex.: Primeiro contato — pedidos">
          <input id="name" autoComplete="off" className={controlClass} aria-invalid={errors.name ? true : undefined} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="channel" label="Canal" error={err('channel')}>
            <select id="channel" className={controlClass} {...register('channel')}>
              {Object.entries(channels).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="step" label="Passo" error={err('step')}>
            <select id="step" className={controlClass} {...register('step')}>
              {Object.entries(stepLabels).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="temperature"
            label="Para leads"
            error={err('temperature')}
            hint={channel === 'whatsapp' ? 'WhatsApp só para morno ou quente.' : 'Em branco: qualquer temperatura.'}
          >
            <select id="temperature" className={controlClass} aria-invalid={errors.temperature ? true : undefined} {...register('temperature')}>
              <option value="">{channel === 'whatsapp' ? 'Escolha…' : 'Qualquer temperatura'}</option>
              <option value="cold">Frios</option>
              <option value="warm">Mornos</option>
              <option value="hot">Quentes</option>
            </select>
          </Field>
          <Field id="product_id" label="Sistema" error={err('product_id')} hint="Em branco: modelo geral.">
            <select id="product_id" className={controlClass} {...register('product_id')}>
              <option value="">Sem sistema</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? '' : ' (inativo)'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {channel === 'email' && (
          <Field id="subject" label="Assunto *" error={err('subject')}>
            <input id="subject" autoComplete="off" className={controlClass} aria-invalid={errors.subject ? true : undefined} {...register('subject')} />
          </Field>
        )}
        <Field
          id="body"
          label="Mensagem *"
          error={err('body')}
          hint={`Use ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}. Escreva curto, como você falaria, e termine com uma pergunta só.`}
        >
          <textarea id="body" className={textareaClass} aria-invalid={errors.body ? true : undefined} {...register('body')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="openings" label="Aberturas (uma por linha)" error={err('openings')} hint="Cada lead recebe sempre a mesma, mas leads diferentes recebem aberturas diferentes.">
            <textarea id="openings" className={textareaClass} {...register('openings')} />
          </Field>
          <Field id="closings" label="Fechamentos (uma por linha)" error={err('closings')} hint="Ex.: Abraço / Até mais / Um abraço">
            <textarea id="closings" className={textareaClass} {...register('closings')} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register('active')} />
          Ativo
        </label>
      </fieldset>

      {warnings.length > 0 && (
        <ul aria-label="Avisos do modelo" className="space-y-1.5">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="rounded-md bg-tone-warning-bg px-3 py-1.5 text-sm text-tone-warning">
              {w.message}
            </li>
          ))}
        </ul>
      )}

      <TemplatePreview
        templateId={templateId}
        channel={channel}
        step={step}
        subject={v.subject ?? ''}
        body={v.body ?? ''}
        openings={v.openings ?? ''}
        closings={v.closings ?? ''}
        leads={leads.data ?? []}
        product={product ? { name: product.name, value_proposition: product.value_proposition, demo_url: product.demo_url } : null}
      />

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
