import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { withCurrentOption } from '@/components/option-list'
import { Button } from '@/components/ui/button'
import { useClientOptions } from '@/features/clients/api'
import { useProjectOptions } from '@/features/projects/api'
import { useUnsavedChangesGuard } from '@/lib/unsaved'
import { accessCategories, accessDefaults, accessFormSchema, type AccessFormValues } from './schema'

export function AccessForm({
  initial = accessDefaults,
  readOnly,
  submitLabel,
  serverError,
  onSubmit,
}: {
  initial?: AccessFormValues
  readOnly?: boolean
  submitLabel: string
  serverError?: string | null
  onSubmit: (values: AccessFormValues) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AccessFormValues>({ resolver: zodResolver(accessFormSchema), defaultValues: initial })
  const projects = useProjectOptions(true)
  const clients = useClientOptions(true)
  const projectOptions = withCurrentOption(projects.data, initial.project_id, projects.isPending, 'Projeto atual (arquivado)')
  const clientOptions = withCurrentOption(clients.data, initial.client_id, clients.isPending, 'Cliente atual (arquivado)')

  const category = useWatch({ control, name: 'category' })

  useUnsavedChangesGuard(isDirty && !isSubmitting)

  const submit = handleSubmit(async (values) => {
    await onSubmit(values)
    reset(values)
  })
  const err = (k: keyof AccessFormValues) => errors[k]?.message
  const inv = (k: keyof AccessFormValues) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="border border-border bg-card px-3 py-2 text-sm">
        <strong>Não guarde senhas aqui.</strong> Este registro é só um atalho: o serviço, o endereço, o usuário e
        onde está o item no seu gerenciador de senhas. O conteúdo <strong>não é criptografado</strong>.
      </p>

      <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
        <Field id="name" label="Serviço *" error={err('name')} hint="Ex.: Supabase — painel, GitHub, Gmail">
          <input id="name" className={controlClass} aria-invalid={inv('name')} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="category" label="Categoria" error={err('category')}>
            <input id="category" autoComplete="off" className={controlClass} {...register('category')} />
            {/* Sugestões como botões: o <datalist> do navegador não segue o tema do sistema. */}
            <div role="group" aria-label="Sugestões de categoria" className="flex flex-wrap gap-1.5 pt-1">
              {accessCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setValue('category', c, { shouldDirty: true, shouldValidate: true })}
                  className={
                    'min-h-9 rounded-sm border px-2.5 text-sm font-semibold pointer-coarse:min-h-11 ' +
                    (category === c
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-strong bg-card hover:bg-muted')
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field id="username" label="Usuário ou e-mail" error={err('username')}>
            <input id="username" autoComplete="off" className={controlClass} aria-invalid={inv('username')} {...register('username')} />
          </Field>
        </div>
        <Field id="url" label="Endereço (URL)" error={err('url')} hint="Comece com https://">
          <input id="url" type="url" inputMode="url" autoComplete="off" className={controlClass} aria-invalid={inv('url')} {...register('url')} />
        </Field>
        <Field id="manager_item" label="Item no gerenciador de senhas" error={err('manager_item')} hint="O nome que você procura lá (não a senha)">
          <input id="manager_item" autoComplete="off" className={controlClass} {...register('manager_item')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="project_id" label="Projeto">
            <select id="project_id" className={controlClass} {...register('project_id')}>
              <option value="">Sem projeto</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="client_id" label="Cliente">
            <select id="client_id" className={controlClass} {...register('client_id')}>
              <option value="">Sem cliente</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="notes" label="Observações" error={err('notes')} hint="Sem senhas, tokens ou chaves.">
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
