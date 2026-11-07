import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { deriveKeys, importDek, unwrapDek } from '@/lib/vaultCrypto'
import { rpcUnlock, useVaultMeta } from './api'
import { UnlockDialog } from './UnlockDialog'
import { VaultContext, type UnlockOutcome, type VaultState } from './vault-context'

const IDLE_MS = 5 * 60 * 1000

/**
 * Estado do cofre na sessão: a chave de dados só existe aqui, na memória, e some ao travar (manual, 5 min
 * sem uso, troca de usuário ou recarregar a página). Nada disso vai para localStorage.
 */
export function VaultProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const { orgId } = useCurrentWorkspace()
  const qc = useQueryClient()
  const metaQuery = useVaultMeta(orgId)
  const meta = metaQuery.data ?? null
  // A chave guarda de quem é: se a sessão trocar de usuário, ela deixa de valer sem precisar de efeito.
  const [held, setHeld] = useState<{ userId: string; key: CryptoKey } | null>(null)
  const dek = held && held.userId === userId ? held.key : null
  const [requested, setRequested] = useState(false)
  const waiting = useRef<Array<(ok: boolean) => void>>([])

  const resolveWaiting = useCallback((ok: boolean) => {
    const callbacks = waiting.current
    waiting.current = []
    for (const cb of callbacks) cb(ok)
  }, [])

  const lock = useCallback(() => setHeld(null), [])

  const adopt = useCallback((key: CryptoKey) => {
    if (userId) setHeld({ userId, key })
  }, [userId])

  const unlock = useCallback(
    async (masterPassword: string): Promise<UnlockOutcome> => {
      if (!orgId || !userId) return { status: 'error' }
      try {
        const fresh = (await metaQuery.refetch()).data
        if (!fresh) return { status: 'missing' }
        const keys = await deriveKeys(masterPassword, fresh.salt, fresh.iterations)
        const res = await rpcUnlock(orgId, keys.proof)
        void qc.invalidateQueries({ queryKey: ['vault'] })
        if (res.status === 'ok' && res.share) {
          const raw = await unwrapDek(keys.clientKey, res.share, fresh.wrappedDek, fresh.dekIv)
          setHeld({ userId, key: await importDek(raw) })
          raw.fill(0)
          setRequested(false)
          resolveWaiting(true)
          return { status: 'ok' }
        }
        if (res.status === 'wrong') return { status: 'wrong', attemptsLeft: res.attemptsLeft, retryAt: res.retryAt }
        if (res.status === 'locked') return { status: 'locked', attemptsLeft: res.attemptsLeft, retryAt: res.retryAt }
        if (res.status === 'destroyed') return { status: 'destroyed' }
        return { status: 'missing' }
      } catch {
        return { status: 'error' }
      }
    },
    [orgId, userId, metaQuery, qc, resolveWaiting],
  )

  const ensureUnlocked = useCallback(() => {
    if (dek) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      waiting.current.push(resolve)
      setRequested(true)
    })
  }, [dek])

  const unlocked = Boolean(dek)

  // Trava sozinho depois de 5 minutos sem mexer.
  useEffect(() => {
    if (!unlocked) return
    let timer = setTimeout(lock, IDLE_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(lock, IDLE_MS)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    for (const e of events) window.addEventListener(e, reset, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, reset)
    }
  }, [unlocked, lock])

  const value = useMemo<VaultState>(
    () => ({
      ready: metaQuery.isSuccess || metaQuery.isError,
      exists: Boolean(meta),
      meta,
      unlocked,
      dek,
      unlock,
      adopt,
      lock,
      ensureUnlocked,
    }),
    [metaQuery.isSuccess, metaQuery.isError, meta, unlocked, dek, unlock, adopt, lock, ensureUnlocked],
  )

  return (
    <VaultContext.Provider value={value}>
      {children}
      <UnlockDialog
        open={requested && !unlocked}
        meta={meta}
        onUnlock={unlock}
        onClose={() => {
          setRequested(false)
          resolveWaiting(false)
        }}
      />
    </VaultContext.Provider>
  )
}
