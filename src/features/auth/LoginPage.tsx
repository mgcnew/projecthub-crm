import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { loginSchema, type LoginValues } from './loginSchema'


export function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (!loading && session) return <Navigate to="/app" replace />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      // Mensagem genérica: não revela se o e-mail existe.
      setFormError('E-mail ou senha incorretos.')
      return
    }
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from.startsWith('/app') ? from : '/app', { replace: true })
  })

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
      {/* Painel de marca (desktop): o dia como diagrama de linhas; decorativo. */}
      <aside aria-hidden="true" className="relative hidden overflow-hidden bg-foreground text-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="flex items-center gap-3 text-xl font-bold tracking-[-0.01em]">
          <span className="inline-flex size-8 items-center justify-center bg-card text-base text-foreground">P</span>
          ProjectHub
        </p>
        <div className="relative h-64">
          <span className="absolute top-[42%] left-0 h-2.5 w-full bg-[#0455a1]" />
          <span className="absolute top-[22%] left-[38%] h-2.5 w-[62%] bg-[#007e5e]" />
          <span className="absolute top-[22%] left-[38%] h-[calc(20%+0.625rem)] w-2.5 bg-[#007e5e]" />
          <span className="absolute top-[62%] left-[18%] h-2.5 w-[82%] bg-[#ffd400]" />
          <span className="absolute top-[42%] left-[18%] h-[calc(20%+0.625rem)] w-2.5 bg-[#ffd400]" />
          {[18, 38, 64, 86].map((x) => (
            <span key={x} className="absolute top-[42%] size-7 -translate-x-1/2 -translate-y-[0.6rem] rounded-full border-[6px] border-card bg-foreground" style={{ left: `${x}%` }} />
          ))}
          <span className="absolute top-[42%] left-[64%] size-7 -translate-x-1/2 -translate-y-[0.6rem] rounded-full border-[6px] border-[#ee372f] bg-foreground" />
        </div>
        <div className="max-w-md space-y-2">
          <p className="text-3xl leading-tight font-bold tracking-[-0.02em]">Seu dia, estação por estação.</p>
          <p className="text-[#c4cad0]">Clientes, projetos, reuniões e tarefas na mesma linha.</p>
        </div>
      </aside>

      <main className="flex flex-col justify-center gap-8 px-5 py-10 sm:px-10">
        <p className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.01em] lg:hidden">
          <span aria-hidden="true" className="inline-flex size-7 items-center justify-center bg-foreground text-sm text-card">P</span>
          ProjectHub
        </p>
        <header className="space-y-1 border-b-2 border-rule-strong pb-4">
          <h1 className="text-[1.875rem] leading-tight font-bold tracking-[-0.02em]">Entrar</h1>
          <p className="text-muted-foreground">Acesse sua central de projetos e clientes.</p>
        </header>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold">
            E-mail
          </label>
          <input
            id="email"
            type="email"
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
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={controlClass}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
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

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      </main>
    </div>
  )
}
