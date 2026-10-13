import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { newPasswordSchema, type NewPasswordValues } from './passwordSchema'

/** Define a nova senha da sessão atual. A sessão precisa estar em aal2 se houver MFA (exigência do Auth). */
export function NewPasswordForm({
  submitLabel,
  onDone,
}: {
  submitLabel: string
  onDone: () => void | Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(
        /same|different/i.test(err.message)
          ? 'A nova senha precisa ser diferente da atual.'
          : /weak|password/i.test(err.message)
            ? 'A senha não atende à política de segurança. Use 12 caracteres ou mais, com maiúscula, minúscula e número.'
            : 'Não foi possível alterar a senha. Tente de novo.',
      )
      return
    }
    reset()
    await onDone()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-sm font-semibold">
          Nova senha
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className={controlClass}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'new-password-error' : 'new-password-hint'}
          {...register('password')}
        />
        {errors.password ? (
          <p id="new-password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : (
          <p id="new-password-hint" className="text-sm text-muted-foreground">
            12 caracteres ou mais, com maiúscula, minúscula e número.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="text-sm font-semibold">
          Repita a nova senha
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className={controlClass}
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
          {...register('confirm')}
        />
        {errors.confirm && (
          <p id="confirm-password-error" className="text-sm text-destructive">
            {errors.confirm.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : submitLabel}
      </Button>
    </form>
  )
}
