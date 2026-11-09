import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { productDefaults, productFormSchema, type ProductFormValues } from './schema'

export function ProductForm({
  initial = productDefaults,
  readOnly,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial?: ProductFormValues
  readOnly?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: ProductFormValues) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: initial })
  useUnsavedChangesGuard(isDirty && !isSubmitting)
  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof ProductFormValues) => errors[k]?.message

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="name" label="Nome do sistema *" error={err('name')}>
          <input id="name" autoComplete="off" className={controlClass} aria-invalid={errors.name ? true : undefined} {...register('name')} />
        </Field>
        <Field
          id="value_proposition"
          label="Proposta de valor"
          error={err('value_proposition')}
          hint="Uma frase curta. Entra nas mensagens no lugar de {{proposta}}. Ex.: cardápio digital sem taxa por pedido"
        >
          <input id="value_proposition" autoComplete="off" className={controlClass} {...register('value_proposition')} />
        </Field>
        <Field id="audience" label="Para quem é" error={err('audience')} hint="Ex.: restaurantes e padarias com entrega">
          <input id="audience" autoComplete="off" className={controlClass} {...register('audience')} />
        </Field>
        <Field id="demo_url" label="Endereço da demonstração" error={err('demo_url')} hint="Comece com https://. Entra no lugar de {{demo}} a partir do 2º passo.">
          <input id="demo_url" type="url" inputMode="url" autoComplete="off" className={controlClass} aria-invalid={errors.demo_url ? true : undefined} {...register('demo_url')} />
        </Field>
        <Field id="price_note" label="Observação de preço" error={err('price_note')} hint="Só para você (não entra na mensagem). Ex.: a partir de R$ 99/mês">
          <input id="price_note" autoComplete="off" className={controlClass} {...register('price_note')} />
        </Field>
        <Field id="description" label="Descrição" error={err('description')}>
          <textarea id="description" className={textareaClass} {...register('description')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register('active')} />
          Ativo (aparece nos seletores de modelos e leads)
        </label>
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
