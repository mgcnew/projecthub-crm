import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { loginSchema, type LoginValues } from './loginSchema'
import { SecondFactorForm } from './SecondFactorForm'

export function LoginPage() {
  const { session, loading, needsSecondFactor } = useAuth()
  const location = useLocation()
  const state = location.state as { from?: string; notice?: string } | null
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  // Com sessão completa (aal2, ou sem MFA) segue para o app; a navegação sai do próprio estado de sessão.
  if (!loading && session && !needsSecondFactor) {
    const from = state?.from
    return <Navigate to={from && from.startsWith('/app') ? from : '/app'} replace />
  }

  if (!loading && session && needsSecondFactor) {
    return (
      <AuthLayout title="Verificação em duas etapas" subtitle="Falta só o código do seu aplicativo autenticador.">
        <SecondFactorForm />
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    // Mensagem genérica: não revela se o e-mail existe.
    if (error) setFormError('E-mail ou senha incorretos.')
  })

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua central de projetos e clientes.">
      {state?.notice && (
        <p role="status" className="border border-border bg-card px-3 py-2 text-sm font-medium">
          {state.notice}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
            className={controlClass}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-semibold">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`${controlClass} pr-12`}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-controls="password"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}

        <div className="space-y-3 pt-2">
          <Button type="submit" className="h-12 w-full justify-between px-4" disabled={isSubmitting || loading}>
            {isSubmitting ? 'Entrando…' : loading ? 'Carregando…' : 'Entrar'}
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
          <p className="text-center text-sm">
            <Link to="/recuperar-senha" className="inline-flex min-h-11 items-center font-semibold text-primary-strong underline underline-offset-4 hover:text-foreground">
              Esqueci a senha
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
