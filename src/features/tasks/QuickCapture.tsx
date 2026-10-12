import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/components/form-styles'
import { simpleTitleSchema } from './schema'

/** Captura rápida: pede somente o título (UI_UX_SPEC). */
export function QuickCapture({
  placeholder = 'Nova tarefa — digite o título e tecle Enter',
  label = 'Nova tarefa',
  onCreate,
}: {
  placeholder?: string
  /** Nome acessível do campo; precisa ser distinto quando há vários na página. */
  label?: string
  onCreate: (title: string) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ title: string }>({ resolver: zodResolver(simpleTitleSchema), defaultValues: { title: '' } })

  const submit = handleSubmit(async ({ title }) => {
    setError(null)
    try {
      await onCreate(title)
      reset()
    } catch {
      setError('Não foi possível criar a tarefa.')
    }
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-1">
      <div className="flex gap-2">
        <input
          aria-label={label}
          placeholder={placeholder}
          className={controlClass}
          aria-invalid={errors.title ? true : undefined}
          disabled={isSubmitting}
          {...register('title')}
        />
        <Button type="submit" className="h-11" disabled={isSubmitting}>
          Adicionar
        </Button>
      </div>
      {(errors.title?.message || error) && (
        <p role="alert" className="text-sm text-destructive">
          {errors.title?.message ?? error}
        </p>
      )}
    </form>
  )
}
