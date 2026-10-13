import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import { NewPasswordForm } from '@/features/auth/NewPasswordForm'
import { codeSchema, type CodeValues } from '@/features/auth/passwordSchema'
import { supabase } from '@/lib/supabase'

type Enrollment = { factorId: string; qr: string; secret: string }

const factorsKey = ['mfa', 'factors'] as const

function useFactors() {
  return useQuery({
    queryKey: factorsKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return { verified: data.totp, all: data.all }
    },
  })
}

/** Senha e verificação em duas etapas (TOTP). A imposição é do banco (D082); aqui só a gestão. */
export function SecuritySection() {
  const factors = useFactors()
  const qc = useQueryClient()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) })

  const active = factors.data?.verified[0] ?? null

  const refresh = () => qc.invalidateQueries({ queryKey: factorsKey })

  const startEnrollment = async () => {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      // Inscrições abandonadas (não verificadas) impedem uma nova com o mesmo nome: limpa antes.
      const list = await supabase.auth.mfa.listFactors()
      for (const f of list.data?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Autenticador' })
      if (err || !data) throw err ?? new Error('enroll')
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
      reset()
    } catch {
      setError('Não foi possível iniciar a configuração. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const cancelEnrollment = async () => {
    if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId })
    setEnrollment(null)
    setError(null)
    reset()
  }

  const confirmEnrollment = handleSubmit(async ({ code }) => {
    if (!enrollment) return
    setError(null)
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code })
    if (err) {
      setError('Código inválido ou expirado. Confira o aplicativo e tente de novo.')
      return
    }
    setEnrollment(null)
    reset()
    setMessage('Verificação em duas etapas ativada. Ela será pedida em cada novo acesso.')
    await refresh()
  })

  const disable = async () => {
    if (!active) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: active.id })
    setBusy(false)
    setConfirmOff(false)
    if (err) {
      setError('Não foi possível desativar. Saia, entre de novo com o código e tente outra vez.')
      return
    }
    setMessage('Verificação em duas etapas desativada.')
    await refresh()
  }

  return (
    <>
      <section aria-labelledby="mfa-h" className="max-w-xl space-y-3">
        <h2 id="mfa-h" className="section-title">
          Verificação em duas etapas
        </h2>
        <p className="text-sm text-muted-foreground">
          Além da senha, o acesso passa a pedir um código de 6 dígitos de um aplicativo autenticador (como
          Google Authenticator, 1Password ou Authy). A proteção vale também para os dados, não só para a tela.
        </p>

        {factors.isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {factors.isError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível ler o estado da verificação em duas etapas.
          </p>
        )}

        {factors.isSuccess && !enrollment && (
          <>
            <p className="text-sm font-semibold">
              Situação: {active ? 'ativada' : 'desativada'}
            </p>
            {active ? (
              <Button variant="outline" disabled={busy} onClick={() => setConfirmOff(true)}>
                Desativar
              </Button>
            ) : (
              <Button disabled={busy} onClick={startEnrollment}>
                {busy ? 'Preparando…' : 'Ativar verificação em duas etapas'}
              </Button>
            )}
          </>
        )}

        {enrollment && (
          <div className="plate space-y-4 p-4">
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>
                Abra o aplicativo autenticador e escaneie o código abaixo.
                <img
                  src={enrollment.qr}
                  alt="QR code para o aplicativo autenticador"
                  width={176}
                  height={176}
                  className="mt-2 border border-border bg-white p-2"
                />
              </li>
              <li>
                Sem câmera? Digite este segredo no aplicativo:{' '}
                <code className="font-mono break-all select-all" data-testid="mfa-secret">
                  {enrollment.secret}
                </code>
              </li>
              <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
            </ol>
            <form onSubmit={confirmEnrollment} noValidate className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="enroll-code" className="text-sm font-semibold">
                  Código de verificação
                </label>
                <input
                  id="enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={controlClass}
                  aria-invalid={errors.code ? true : undefined}
                  aria-describedby={errors.code ? 'enroll-code-error' : undefined}
                  {...register('code')}
                />
                {errors.code && (
                  <p id="enroll-code-error" className="text-sm text-destructive">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Guarde o segredo em um gerenciador de senhas: sem o aplicativo você não consegue entrar.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Verificando…' : 'Confirmar e ativar'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEnrollment}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>

      <section aria-labelledby="pwd-h" className="max-w-xl space-y-3">
        <h2 id="pwd-h" className="section-title">
          Alterar senha
        </h2>
        <NewPasswordForm
          submitLabel="Salvar nova senha"
          onDone={() => setPasswordMessage('Senha alterada.')}
        />
        {passwordMessage && <p role="status" className="text-sm text-emerald-700">{passwordMessage}</p>}
      </section>

      <ConfirmDialog
        open={confirmOff}
        title="Desativar a verificação em duas etapas?"
        description="Sua conta voltará a exigir apenas a senha. Você pode ativar de novo quando quiser."
        confirmLabel="Desativar"
        pending={busy}
        onConfirm={disable}
        onCancel={() => setConfirmOff(false)}
      />
    </>
  )
}
