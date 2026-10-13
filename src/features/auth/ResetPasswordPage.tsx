import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { NewPasswordForm } from './NewPasswordForm'
import { SecondFactorForm } from './SecondFactorForm'

/**
 * Destino do link do e-mail de recuperação. O cliente do Supabase troca o token da URL por uma sessão
 * (aal1). Com MFA ativo, o Auth só aceita a troca de senha em aal2: pede o código antes (D082).
 */
export function ResetPasswordPage() {
  const { session, loading, needsSecondFactor } = useAuth()
  const navigate = useNavigate()
  const [finished, setFinished] = useState(false)

  if (loading || finished) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center text-muted-foreground">
        Carregando…
      </div>
    )
  }

  if (!session) {
    return (
      <AuthLayout title="Link inválido ou expirado" subtitle="O link de recuperação vale por 1 hora e só pode ser usado uma vez.">
        <Link to="/recuperar-senha" className="inline-block py-2.5 text-sm font-semibold text-primary-strong underline">
          Pedir um novo link
        </Link>
      </AuthLayout>
    )
  }

  if (needsSecondFactor) {
    return (
      <AuthLayout title="Confirme que é você" subtitle="Sua conta usa verificação em duas etapas.">
        <SecondFactorForm />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha nova para entrar.">
      <NewPasswordForm
        submitLabel="Salvar nova senha"
        onDone={async () => {
          // Encerra a sessão de recuperação: entra de novo com a senha nova (e o código, se houver).
          setFinished(true)
          await supabase.auth.signOut()
          navigate('/login', { replace: true, state: { notice: 'Senha alterada. Entre com a nova senha.' } })
        }}
      />
    </AuthLayout>
  )
}
