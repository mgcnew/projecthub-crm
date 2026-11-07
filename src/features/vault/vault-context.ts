import { createContext, useContext } from 'react'
import type { VaultMeta } from './api'

export type UnlockOutcome =
  | { status: 'ok' }
  | { status: 'wrong'; attemptsLeft: number | null; retryAt: string | null }
  | { status: 'locked'; attemptsLeft: number | null; retryAt: string | null }
  | { status: 'destroyed' }
  | { status: 'missing' }
  | { status: 'error' }

export type VaultState = {
  /** false enquanto a situação do cofre carrega. */
  ready: boolean
  exists: boolean
  meta: VaultMeta | null
  unlocked: boolean
  /** Chave de dados (não extraível), só na memória da sessão destravada. */
  dek: CryptoKey | null
  unlock: (masterPassword: string) => Promise<UnlockOutcome>
  /** Usado logo depois de criar o cofre: já abre com a chave recém-gerada. */
  adopt: (dek: CryptoKey) => void
  lock: () => void
  /** Pede a senha mestra (diálogo) se estiver trancado; resolve `true` quando destravado. */
  ensureUnlocked: () => Promise<boolean>
}

export const VaultContext = createContext<VaultState | null>(null)

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault deve ser usado dentro de <VaultProvider>')
  return ctx
}
