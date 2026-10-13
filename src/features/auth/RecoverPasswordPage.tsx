import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'
import { recoverSchema, type RecoverValues } from './passwordSchema'

export function RecoverPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoverValues>({ resolver: zodResolver(recoverSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    // Resposta única para e-mail existente ou não: não revela quem tem conta. Só falha de envio aparece.
    if (err && (err.status === 429 || err.status === undefined || err.status >= 500)) {
      setError('Não foi possível enviar agora. Tente de novo em alguns minutos.')
      return
    }
    setSent(true)
  })

  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <div className="space-y-4">
          <p role="status" className="border border-border bg-card px-3 py-2 text-sm font-medium">
            Se esse e-mail tiver uma conta, enviamos um link para redefinir a senha. Ele vale por 1 hora.
          </p>
          <Link to="/login" className="inline-block py-2.5 text-sm font-semibold text-primary-strong underline">
            Voltar para entrar
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="recover-email" className="text-sm font-semibold">
              E-mail
            </label>
            <input
              id="recover-email"
              type="email"
              autoComplete="username"
              className={controlClass}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'recover-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="recover-email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar link'}
          </Button>
          <Link to="/login" className="inline-block py-2.5 text-sm font-semibold text-primary-strong underline">
            Voltar para entrar
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
