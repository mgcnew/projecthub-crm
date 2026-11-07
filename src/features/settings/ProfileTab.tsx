import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Avatar } from '@/components/Avatar'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { formatDate } from '@/lib/format'
import { useProfile, useSaveProfile } from './api'
import { profileSchema, type ProfileValues } from './schema'

/** Quem é você: nome exibido no menu e dados de acesso (o e-mail muda em "Conta e segurança"). */
export function ProfileTab({ goToAccount }: { goToAccount: () => void }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const email = session?.user.email ?? ''
  const profile = useProfile(userId)
  const save = useSaveProfile(userId)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { display_name: profile.data?.display_name ?? '' },
  })
  const typed = watch('display_name')

  const submit = handleSubmit(async ({ display_name }) => {
    setMessage(null)
    setError(null)
    try {
      await save.mutateAsync(display_name)
      setMessage('Perfil salvo.')
    } catch {
      setError('Não foi possível salvar o perfil. Tente de novo.')
    }
  })

  return (
    <Plate id="profile-h" title="Seu perfil">
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar name={typed || profile.data?.display_name} email={email} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{profile.data?.display_name ?? email}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        {profile.isError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar o perfil.
          </p>
        )}

        <form onSubmit={submit} noValidate className="space-y-4">
          <Field
            id="display-name"
            label="Nome"
            error={errors.display_name?.message}
            hint="Aparece no menu lateral."
          >
            <input
              id="display-name"
              autoComplete="name"
              className={controlClass}
              aria-invalid={errors.display_name ? true : undefined}
              aria-describedby={errors.display_name ? 'display-name-error' : undefined}
              {...register('display_name')}
            />
          </Field>
          <Field id="login-email" label="E-mail de acesso" hint="É o e-mail que você usa para entrar.">
            <input id="login-email" className={controlClass} value={email} readOnly aria-readonly="true" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={save.isPending || !isDirty}>
              {save.isPending ? 'Salvando…' : 'Salvar perfil'}
            </Button>
            <Button type="button" variant="outline" onClick={goToAccount}>
              Alterar e-mail ou senha
            </Button>
          </div>
          {message && (
            <p role="status" className="text-sm text-tone-success">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        {session?.user.created_at && (
          <p className="text-sm text-muted-foreground">Conta criada em {formatDate(session.user.created_at)}.</p>
        )}
      </div>
    </Plate>
  )
}
