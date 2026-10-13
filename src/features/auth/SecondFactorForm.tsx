import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { verifiedTotpFactor } from './mfa'
import { codeSchema, type CodeValues } from './passwordSchema'

/**
 * Segunda etapa: código do aplicativo autenticador. Ao verificar, a sessão sobe para aal2 e o
 * AuthProvider reavalia sozinho (onAuthStateChange); quem usa este formulário só reage a `session`.
 */
export function SecondFactorForm() {
  const { session, signOut } = useAuth()
  const factor = verifiedTotpFactor(session)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) })

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null)
    if (!factor) {
      setError('Não encontramos o autenticador desta conta. Saia e entre de novo.')
      return
    }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (err) setError('Código inválido ou expirado. Confira o aplicativo e tente de novo.')
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Digite o código de 6 dígitos que aparece no seu aplicativo autenticador.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="mfa-code" className="text-sm font-semibold">
          Código de verificação
        </label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className={controlClass}
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={errors.code ? 'mfa-code-error' : undefined}
          {...register('code')}
        />
        {errors.code && (
          <p id="mfa-code-error" className="text-sm text-destructive">
            {errors.code.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11 flex-1" disabled={isSubmitting}>
          {isSubmitting ? 'Verificando…' : 'Verificar'}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => void signOut()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
