import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import { emailChangeSchema, type EmailChangeValues } from './schema'

/** Troca do e-mail de acesso: o Auth manda um link de confirmação e só então o e-mail muda. */
export function EmailSection() {
  const { session } = useAuth()
  const current = session?.user.email ?? ''
  const [sentTo, setSentTo] = useState<string | null>(session?.user.new_email ?? null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmailChangeValues>({ resolver: zodResolver(emailChangeSchema), defaultValues: { email: '' } })

  const submit = handleSubmit(async ({ email }) => {
    setError(null)
    if (email.toLowerCase() === current.toLowerCase()) {
      setError('Esse já é o seu e-mail de acesso.')
      return
    }
    const { error: err } = await supabase.auth.updateUser({ email })
    if (err) {
      setError(
        /already|registered|exists/i.test(err.message)
          ? 'Este e-mail já está em uso por outra conta.'
          : /rate|seconds|too many/i.test(err.message)
            ? 'Muitas tentativas. Aguarde um pouco e tente de novo.'
            : 'Não foi possível pedir a troca de e-mail. Tente de novo.',
      )
      return
    }
    setSentTo(email)
    reset()
  })

  return (
    <Plate id="email-h" title="E-mail de acesso">
      <div className="max-w-xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Hoje você entra com <span className="font-semibold text-foreground">{current}</span>. Ao pedir a troca,
          enviamos um link de confirmação; o e-mail só muda depois que você clicar nele.
        </p>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="new-email" label="Novo e-mail" error={errors.email?.message}>
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              className={controlClass}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'new-email-error' : undefined}
              {...register('email')}
            />
          </Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Pedir troca de e-mail'}
          </Button>
        </form>
        {sentTo && (
          <p role="status" className="rounded-lg bg-tone-info-bg px-3 py-2 text-sm font-medium text-tone-info">
            Enviamos um link para {sentTo}. Abra o e-mail e confirme para concluir a troca (se o seu e-mail atual
            também receber um link, confirme nos dois).
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Plate>
  )
}
