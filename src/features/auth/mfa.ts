import type { Session } from '@supabase/supabase-js'

/** Nível de garantia da sessão (claim `aal` do JWT). `null` sem sessão ou com token ilegível. */
export function sessionAal(session: Session | null): 'aal1' | 'aal2' | null {
  if (!session) return null
  try {
    const part = session.access_token.split('.')[1]
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { aal?: string }
    return claims.aal === 'aal2' ? 'aal2' : 'aal1'
  } catch {
    return null
  }
}

/** Fator TOTP verificado do usuário, se houver. */
export function verifiedTotpFactor(session: Session | null) {
  return session?.user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null
}

/**
 * A senha já foi aceita, mas o banco só libera os dados em aal2. Espelha a política `mfa_required`
 * (D082): sessão aal1 + fator verificado = falta o código do autenticador.
 */
export function needsSecondFactor(session: Session | null): boolean {
  return verifiedTotpFactor(session) !== null && sessionAal(session) !== 'aal2'
}
