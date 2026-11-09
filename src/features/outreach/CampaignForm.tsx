import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { useProductOptions, useTemplates } from './api'
import { campaignDefaults, campaignFormSchema, channels, type CampaignFormValues } from './schema'

export function CampaignForm({
  initial = campaignDefaults,
  readOnly,
  lockPublic,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial?: CampaignFormValues
  readOnly?: boolean
  /** Canal e público não mudam depois de criada (os leads já foram escolhidos por eles). */
  lockPublic?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: CampaignFormValues) => Promise<void>
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CampaignFormValues>({ resolver: zodResolver(campaignFormSchema), defaultValues: initial })
  useUnsavedChangesGuard(isDirty && !isSubmitting)
  const products = useProductOptions(true)
  const templates = useTemplates({ channel: '', step: '', status: 'active' }, true)
  const v = useWatch({ control })
  const channel = v.channel === 'whatsapp' ? 'whatsapp' : 'email'
  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof CampaignFormValues) => errors[k]?.message
  const options = (step: number) =>
    (templates.data ?? []).filter((t) => t.channel === channel && t.step === step)

  const templateField = (step: 1 | 2 | 3, id: 'step1_template_id' | 'step2_template_id' | 'step3_template_id', hasStep: boolean) => (
    <Field
      id={id}
      label={`Modelo do passo ${step}${step === 1 ? ' *' : ''}`}
      error={err(id)}
      hint={options(step).length === 0 ? `Crie um modelo de ${channels[channel]} do passo ${step} em Modelos.` : undefined}
    >
      <select id={id} className={controlClass} disabled={!hasStep} {...register(id)}>
        <option value="">{step === 1 ? 'Escolha…' : 'Sem este passo'}</option>
        {options(step).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  )

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="name" label="Nome da campanha *" error={err('name')} hint="Ex.: Pedidos para padarias — novembro">
          <input id="name" autoComplete="off" className={controlClass} aria-invalid={errors.name ? true : undefined} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="channel" label="Canal" error={err('channel')}>
            <select id="channel" className={controlClass} disabled={lockPublic} {...register('channel')}>
              {Object.entries(channels).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="temperature"
            label="Público (temperatura)"
            error={err('temperature')}
            hint={channel === 'whatsapp' ? 'WhatsApp só para morno ou quente.' : 'Em branco: qualquer temperatura.'}
          >
            <select id="temperature" className={controlClass} disabled={lockPublic} aria-invalid={errors.temperature ? true : undefined} {...register('temperature')}>
              <option value="">{channel === 'whatsapp' ? 'Escolha…' : 'Qualquer temperatura'}</option>
              <option value="cold">Frios</option>
              <option value="warm">Mornos</option>
              <option value="hot">Quentes</option>
            </select>
          </Field>
          <Field id="product_id" label="Sistema" error={err('product_id')} hint="Alimenta {{sistema}}, {{proposta}} e {{demo}}. Em branco: o sistema de interesse de cada lead.">
            <select id="product_id" className={controlClass} {...register('product_id')}>
              <option value="">Do lead</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="daily_limit" label="Rascunhos por dia" error={err('daily_limit')} hint="No máximo quantos rascunhos a campanha gera por dia (1 a 100).">
            <input id="daily_limit" inputMode="numeric" className={controlClass} aria-invalid={errors.daily_limit ? true : undefined} {...register('daily_limit')} />
          </Field>
        </div>

        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="section-title pr-2">Sequência</legend>
          <p className="text-sm text-muted-foreground">
            O passo 1 é a primeira mensagem. Os lembretes saem alguns dias depois dela e param quando o lead responde ou pede para sair.
          </p>
          {templateField(1, 'step1_template_id', true)}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="followup_1" label="1º lembrete (dias depois)" error={err('followup_1')} hint="Em branco: sem lembretes.">
              <input id="followup_1" inputMode="numeric" className={controlClass} aria-invalid={errors.followup_1 ? true : undefined} {...register('followup_1')} />
            </Field>
            {templateField(2, 'step2_template_id', (v.followup_1 ?? '') !== '')}
            <Field id="followup_2" label="2º lembrete (dias depois)" error={err('followup_2')} hint="Contado a partir da 1ª mensagem.">
              <input id="followup_2" inputMode="numeric" className={controlClass} aria-invalid={errors.followup_2 ? true : undefined} {...register('followup_2')} />
            </Field>
            {templateField(3, 'step3_template_id', (v.followup_2 ?? '') !== '')}
          </div>
        </fieldset>
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
